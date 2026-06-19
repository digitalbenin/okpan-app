<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType } from "$lib/utils/media.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
    import MediaUploadZone from "$lib/components/research_fields/MediaUploadZone.svelte";
    import MediaModal from "$lib/components/research_fields/MediaModal.svelte";
    import LinkMediaModal from "$lib/components/objects/LinkMediaModal.svelte";
    import { unlinkAssetFromObject, reorderAssets, linkAssetToObject } from "$lib/api/ObjectsApi.js";
    import { invalidate } from "$app/navigation";
    import { dragHandleZone, dragHandle } from "svelte-dnd-action";
    import { flip } from "svelte/animate";

    const { object, projectId = null, institutionId = null, onChangesUpdate = null } = $props();
    const { t } = getTranslationStore();

    // State
    const linkedAssets = $derived(object?.objectsAssets || []);
    let pendingRemovals = $state(new Set());
    let pendingAdditions = $state([]);
    let reorderedAssets = $state([]);
    let hasReorderChanges = $state(false);
    let isModalOpen = $state(false);
    let modalAsset = $state(null);
    let isLinkModalOpen = $state(false);
    let audioElements = new Map();

    // Constants
    const flipDurationMs = 200;

    // Derived
    const effectiveInstitutionId = $derived(object?.institution_id ?? institutionId ?? null);
    const isLinkDisabled = $derived(!effectiveInstitutionId);
    const hasChanges = $derived(pendingRemovals.size > 0 || hasReorderChanges || pendingAdditions.length > 0);

    const displayAssets = $derived.by(() => {
        const filtered = linkedAssets.filter((oa) => !pendingRemovals.has(oa.asset.id));
        const pendingAsObjectAssets = pendingAdditions.map((asset, idx) => ({
            id: `new-${asset.id}`,
            order: filtered.length + idx + 1,
            asset,
            pending: true,
        }));
        const baseList = [...filtered, ...pendingAsObjectAssets];
        const assets = hasReorderChanges ? reorderedAssets : baseList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        return assets.map((oa) => ({ ...oa, id: oa.id }));
    });

    // Helpers
    const notifyParent = () => {
        if (onChangesUpdate) {
            onChangesUpdate({
                component: "linked_media",
                hasChanges,
                changes: {
                    removals: Array.from(pendingRemovals),
                    reorders: hasReorderChanges ? reorderedAssets : null,
                    additions: pendingAdditions.map((a) => a.id),
                },
                saveFunction: saveChanges,
            });
        }
    };

    const closeModal = () => {
        isModalOpen = false;
        modalAsset = null;
    };

    const registerAudioElement = (element, assetId) => {
        audioElements.set(assetId, element);
        return { destroy: () => audioElements.delete(assetId) };
    };

    // Handlers
    const handleAssetRemove = (assetId) => {
        pendingRemovals.add(assetId);
        pendingRemovals = new Set(pendingRemovals);
        if (hasReorderChanges) {
            reorderedAssets = reorderedAssets.filter((asset) => asset.asset.id !== assetId);
        }
        notifyParent();
    };

    const handleAddMedia = () => (isLinkModalOpen = true);

    /** Import files to the institution, then link them to this object. */
    async function handleUploadDirect(paths) {
        const instId = object?.institution_id ?? institutionId;
        const projId = object?.project_id ?? projectId;
        if (!instId || !projId || !paths?.length) return;
        try {
            const importResult = await window.api.importAssets({
                projectId: projId,
                institutionId: instId,
                isGenericAsset: false,
                files: paths,
            });
            const newlyCreated = importResult?.createdAssets || [];
            if (newlyCreated.length > 0) {
                handleLinkModalSave(newlyCreated);
            }
        } catch (e) {
            console.error("Failed to upload media:", e);
        }
    }

    const handleAudioToggle = (asset) => {
        const audioElement = audioElements.get(asset.id);
        if (!audioElement) return;

        if (audioElement.paused) {
            audioElements.forEach((audio, id) => {
                if (id !== asset.id && !audio.paused) audio.pause();
            });
            audioElement.play().catch((error) => console.error("Error playing audio:", error));
        } else {
            audioElement.pause();
        }
    };

    const handleViewMedia = (asset) => {
        const assetType = getMediaType(asset);
        if (assetType === "audio") {
            handleAudioToggle(asset);
        } else {
            modalAsset = asset;
            isModalOpen = true;
        }
    };

    const handleDndEvent = (event) => {
        reorderedAssets = [...event.detail.items];
        hasReorderChanges = true;
        notifyParent();
    };

    const handleLinkModalSave = (selectedAssets) => {
        const selectedIds = new Set(selectedAssets.filter((a) => a?.id != null).map((a) => a.id));
        const linkedIds = new Set(linkedAssets.map((oa) => oa.asset.id));

        // Currently active (linked - pendingRemovals + pendingAdditions)
        const currentActiveIds = new Set([
            ...linkedAssets.filter((oa) => !pendingRemovals.has(oa.asset.id)).map((oa) => oa.asset.id),
            ...pendingAdditions.map((a) => a.id),
        ]);

        // 1. Identify removals: currently active but not in new selection
        const toRemove = new Set([...currentActiveIds].filter((id) => !selectedIds.has(id)));
        // 2. Identify additions: in new selection but not currently linked (ignoring removals)
        const toAdd = new Set([...selectedIds].filter((id) => !linkedIds.has(id) || pendingRemovals.has(id)));

        // Update pendingRemovals: add newly deselected linked assets
        const newRemovals = new Set(pendingRemovals);
        for (const id of toRemove) {
            if (linkedIds.has(id)) newRemovals.add(id);
        }
        pendingRemovals = newRemovals;

        // Update pendingAdditions: keep only additions that are still in the new selection;
        // add new ones (with full asset data from selectedAssets)
        const normalizedNew = selectedAssets
            .filter((a) => toAdd.has(a.id))
            .map((a) => ({
                id: a.id,
                filename: a.filename || `asset-${a.id}`,
                path: a.path || null,
                ...a,
            }));
        pendingAdditions = normalizedNew;

        if (hasReorderChanges) {
            const newItems = pendingAdditions.map((asset) => ({
                id: `new-${asset.id}`,
                order: displayAssets.length + 1,
                asset,
                pending: true,
            }));
            reorderedAssets = [...displayAssets, ...newItems];
        }
        notifyParent();
    };

    async function saveChanges(objectIdToSave) {
        if (!hasChanges) return;

        const objectId = objectIdToSave || object?.id;
        if (!objectId) {
            console.error("No object ID provided to save asset changes.");
            return;
        }

        try {
            const promises = [];

            // Link new additions
            if (pendingAdditions.length > 0) {
                const currentCount = linkedAssets.filter((oa) => !pendingRemovals.has(oa.asset.id)).length;
                const addPromises = pendingAdditions.map((asset, index) => {
                    let desiredOrder = currentCount + index + 1;
                    if (hasReorderChanges) {
                        const pos = reorderedAssets.findIndex((item) => item.asset.id === asset.id);
                        desiredOrder = pos >= 0 ? pos + 1 : desiredOrder;
                    }
                    return linkAssetToObject(objectId, asset.id, desiredOrder);
                });
                promises.push(...addPromises);
            }

            // Remove assets
            if (pendingRemovals.size > 0) {
                promises.push(...Array.from(pendingRemovals).map((assetId) => unlinkAssetFromObject(objectId, assetId)));
            }

            // Reorder assets
            if (hasReorderChanges) {
                const assetOrders = reorderedAssets.map((asset, index) => ({
                    assetId: asset.asset.id,
                    order: index + 1,
                }));
                promises.push(reorderAssets(objectId, assetOrders));
            }

            const results = await Promise.all(promises);
            const errors = results.filter((result) => result.error);

            if (errors.length > 0) {
                console.error("Error saving asset changes:", errors);
            } else {
                pendingRemovals.clear();
                pendingRemovals = new Set();
                pendingAdditions = [];
                notifyParent();
                await invalidate("custom:object");
                reorderedAssets = [];
                hasReorderChanges = false;
            }
        } catch (error) {
            console.error("Error saving asset changes:", error);
        }
    }
</script>

<div class="d-flex flex-column gap-3">
    <div class="d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-1">
            <span class="form-label mb-0">
                {t("objects.linked_media.title", { fallback: "Objects images" })}
            </span>
        </div>
        {#if isLinkDisabled}
            <BaseTooltip>
                {#snippet trigger(props)}
                    <div class="d-inline-block" {...(({ type, ...rest }) => rest)(props)}>
                        <BaseButton
                            class="btn btn-sm btn-outline-secondary"
                            icon="plus"
                            text={t("objects.linked_media.link_media", {
                                fallback: "Link media",
                            })}
                            disabled={true}
                        />
                    </div>
                {/snippet}
                {t("objects.linked_media.select-institution-first", {
                    fallback: "Select an institution first",
                })}
            </BaseTooltip>
        {:else}
            <BaseButton
                class="btn btn-sm btn-outline-secondary"
                icon="plus"
                text={t("objects.linked_media.link_media", {
                    fallback: "Link media",
                })}
                onClick={handleAddMedia}
            />
        {/if}
    </div>

    <div class="border border-dashed rounded-4 p-3">
        {#if displayAssets.length > 0}
            <div
                class="d-flex gap-3 overflow-x-auto"
                use:dragHandleZone={{
                    dropTargetStyle: { outline: "none" },
                    items: displayAssets,
                    flipDurationMs,
                }}
                onconsider={handleDndEvent}
                onfinalize={handleDndEvent}
            >
                {#each displayAssets as objectAsset (objectAsset.id)}
                    {@const asset = objectAsset.asset}
                    <div class="flex-shrink-0" style="width: 200px;" animate:flip={{ duration: flipDurationMs }}>
                        <div class="border rounded-3 overflow-hidden position-relative">
                            <!-- Close button -->
                            <button
                                class="btn btn-light btn-sm rounded-pill position-absolute p-1 lh-1 d-flex align-items-center justify-content-center"
                                style="top: 5px; right: 5px; width: 24px; height: 24px; z-index: 2;"
                                type="button"
                                aria-label={t("objects.linked_media.remove-media", {
                                    fallback: "Remove media",
                                })}
                                onclick={(e) => {
                                    e.stopPropagation();
                                    handleAssetRemove(objectAsset.asset.id);
                                }}
                            >
                                <i class="bi bi-x fs-6"></i>
                            </button>

                            <!-- Drag handle -->
                            <button
                                class="btn btn-link p-1 text-secondary position-absolute"
                                style="top: 5px; left: 5px; z-index: 2; cursor: grab;"
                                aria-label={t("media.drag-item", { fallback: "Drag item" })}
                                use:dragHandle
                            >
                                <i class="bi bi-arrows-move small"></i>
                            </button>

                            <!-- Asset preview -->
                            <div
                                class="position-relative bg-light"
                                style="width: 200px; height: 160px; cursor: pointer;"
                                role="button"
                                tabindex="0"
                                onclick={() => handleViewMedia(asset)}
                                onkeydown={(e) => e.key === "Enter" && handleViewMedia(asset)}
                            >
                                <BaseImage
                                    asset={asset}
                                    preferredFormat="md"
                                    alt={asset?.filename || t("media.unnamed-file", { fallback: "Unnamed file" })}
                                    class="w-100 h-100"
                                    objectFit="contain"
                                />
                                {#if getMediaType(asset) === "video"}
                                    <div class="position-absolute top-50 start-50 translate-middle fs-2 text-white" style="opacity: 0.8; pointer-events: none;">
                                        <i class="bi bi-play-circle-fill"></i>
                                    </div>
                                {/if}
                                {#if getMediaType(asset) === "audio"}
                                    <div class="position-absolute top-50 start-50 translate-middle fs-2 text-white" style="opacity: 0.8; pointer-events: none;">
                                        <i class="bi bi-music-note-beamed"></i>
                                    </div>
                                {/if}
                            </div>

                            <!-- Asset filename -->
                            <div class="px-2 py-2 small text-truncate bg-white" title={asset?.filename || t("media.unnamed-file", { fallback: "Unnamed file" })}>
                                {asset?.filename || t("media.unnamed-file", { fallback: "Unnamed file" })}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            {#if !isLinkDisabled}
                <MediaUploadZone
                    type="image"
                    assets={[]}
                    onAdd={handleUploadDirect}
                />
            {:else}
                <div class="text-center py-4 text-muted small">
                    {t("objects.linked_media.no_media", {
                        fallback: "No linked media",
                    })}
                </div>
            {/if}
        {/if}
    </div>
</div>



<!-- Hidden audio elements for playback -->
{#each displayAssets as objectAsset (objectAsset.id)}
    {@const asset = objectAsset.asset}
    {#if getMediaType(asset) === "audio"}
        <audio
            use:registerAudioElement={asset.id}
            src="media://{asset.path}"
            preload="metadata"
            style="display: none;"
        ></audio>
    {/if}
{/each}

<!-- Media Modal -->
<MediaModal asset={modalAsset} isOpen={isModalOpen} onClose={closeModal} />

<!-- Link Media Modal -->
<LinkMediaModal
    isOpen={isLinkModalOpen}
    projectId={object?.project_id ?? projectId}
    institutionId={object?.institution_id ?? institutionId}
    initiallySelectedIds={[...linkedAssets.filter((oa) => !pendingRemovals.has(oa.asset.id)).map((oa) => oa.asset.id), ...pendingAdditions.map((a) => a.id)]}
    onClose={() => (isLinkModalOpen = false)}
    onSave={handleLinkModalSave}
/>
