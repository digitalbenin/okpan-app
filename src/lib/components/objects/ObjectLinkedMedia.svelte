<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType } from "$lib/utils/media.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
    import MediaModal from "$lib/components/research_fields/MediaModal.svelte";
    import LinkMediaModal from "$lib/components/objects/LinkMediaModal.svelte";
    import { unlinkAssetFromObject, reorderAssets, linkAssetToObject } from "$lib/stores/ObjectsUtils.js";
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
        const existingIds = new Set(linkedAssets.map((oa) => oa.asset.id));
        pendingAdditions = selectedAssets.filter((a) => !existingIds.has(a.id));

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

<div class="card bg-white border-0">
    <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-image"></i>
                <span>
                    {t("objects.linked_media.title", { fallback: "Linked media" })}
                </span>
            </div>
            {#if isLinkDisabled}
                <BaseTooltip>
                    {#snippet trigger(props)}
                        <div class="d-inline-block" {...(({ type, ...rest }) => rest)(props)}>
                            <BaseButton
                                class="btn btn-sm btn-light"
                                icon="plus"
                                text={t("objects.linked_media.add_media", {
                                    fallback: "Add media",
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
                    class="btn btn-sm btn-secondary"
                    icon="plus"
                    text={t("objects.linked_media.add_media", {
                        fallback: "Add media",
                    })}
                    onClick={handleAddMedia}
                />
            {/if}
        </div>

        {#if displayAssets.length > 0}
            <div
                class="d-flex gap-3 overflow-x-auto pb-2"
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
                    <div class="flex-shrink-0" style="width: 160px;" animate:flip={{ duration: flipDurationMs }}>
                        <div class="bg-white border rounded overflow-hidden ">
                            <!-- Action buttons bar at top -->
                            <div class="d-flex justify-content-between align-items-center p-0 bg-white border-bottom">
                                <button
                                    class="btn btn-link p-1 text-secondary"
                                    style="cursor: grab;"
                                    aria-label={t("media.drag-item", { fallback: "Drag item" })}
                                    use:dragHandle
                                >
                                    <i class="bi bi-arrows-move"></i>
                                </button>
                                <button
                                    class="btn btn-link p-1 text-secondary"
                                    type="button"
                                    aria-label={t("objects.linked_media.remove-media", {
                                        fallback: "Remove media",
                                    })}
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        handleAssetRemove(objectAsset.asset.id);
                                    }}
                                >
                                    <i class="bi bi-x-circle"></i>
                                </button>
                            </div>

                            <!-- Asset preview -->
                            <div
                                class="position-relative bg-light"
                                style="width: 160px; height: 160px; cursor: pointer;"
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
                            <div class="p-2 small text-truncate text-muted" title={asset?.filename || t("media.unnamed-file", { fallback: "Unnamed file" })}>
                                {asset?.filename || t("media.unnamed-file", { fallback: "Unnamed file" })}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="text-muted small">
                {t("objects.linked_media.no_media", {
                    fallback: "No linked media",
                })}
            </div>
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
    initiallySelectedIds={[...linkedAssets.map((oa) => oa.asset.id), ...pendingAdditions.map((a) => a.id)]}
    onClose={() => (isLinkModalOpen = false)}
    onSave={handleLinkModalSave}
/>
