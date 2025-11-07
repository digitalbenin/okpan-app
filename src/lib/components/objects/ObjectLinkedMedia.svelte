<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
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
    const assetTypePatterns = {
        audio: /\.(mp3|wav|ogg|m4a|aac|flac)$/,
        video: /\.(mp4|webm|mov|avi|mkv)$/,
        image: /\.(jpg|jpeg|png|gif|webp|avif)$/,
    };

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
    const getAssetType = (asset) => {
        const type = asset.type?.toLowerCase();
        const filename = asset.filename?.toLowerCase() || "";
        for (const [assetType, pattern] of Object.entries(assetTypePatterns)) {
            if (type === assetType || filename.match(pattern)) return assetType;
        }
        return "unknown";
    };

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
        const assetType = getAssetType(asset);
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

<div class="bg-white px-2">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="mb-0">
            {t("objects.linked_media.title", { fallback: "Linked media" })}
        </h3>
    </div>

    <!-- Add media button at the top -->
    <div class="mb-3">
        {#if isLinkDisabled}
            <BaseTooltip>
                {#snippet trigger(props)}
                    <div class="d-inline-block" {...(({ type, ...rest }) => rest)(props)}>
                        <BaseButton
                            class="btn btn-outline-secondary"
                            icon="plus"
                            text={t("objects.linked_media.link_media", {
                                fallback: "Link media",
                            })}
                            disabled={true}
                        />
                    </div>
                {/snippet}
                select an institution first
            </BaseTooltip>
        {:else}
            <BaseButton
                class="btn btn-outline-secondary"
                icon="plus"
                text={t("objects.linked_media.link_media", {
                    fallback: "Link media",
                })}
                onClick={handleAddMedia}
            />
        {/if}
    </div>

    <!-- Linked assets list -->
    {#if displayAssets.length > 0}
        <div
            class="linked-assets"
            use:dragHandleZone={{
                dropTargetStyle: { outline: "none" },
                items: displayAssets,
                flipDurationMs,
            }}
            onconsider={handleDndEvent}
            onfinalize={handleDndEvent}
        >
            {#each displayAssets as objectAsset, index (objectAsset.id)}
                {@const asset = objectAsset.asset}
                <div
                    class="d-flex align-items-stretch gap-2 mb-3"
                    animate:flip={{ duration: flipDurationMs }}
                >
                    <!-- Main media card -->
                    <div class="flex-grow-1 bg-white border border-secondary border-opacity-25 rounded overflow-hidden">
                        <!-- Asset thumbnail (square) -->
                        <div
                            class="w-100"
                            style="cursor: pointer; position: relative; padding-bottom: 100%;"
                            role="button"
                            tabindex="0"
                            onclick={() => handleViewMedia(asset)}
                            onkeydown={(e) =>
                                e.key === "Enter" && handleViewMedia(asset)}
                        >
                            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
                                <BaseImage
                                    src={asset?.path ? `media://${asset.path}` : null}
                                    alt={asset?.filename || "Asset"}
                                    class="w-100 h-100"
                                    style="object-fit: contain;"
                                />
                            </div>
                            {#if getAssetType(asset) === "video"}
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;">
                                    <i class="bi bi-play-circle-fill text-white" style="font-size: 3rem; opacity: 0.8;"></i>
                                </div>
                            {/if}
                            {#if getAssetType(asset) === "audio"}
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none;">
                                    <i class="bi bi-music-note-beamed text-white" style="font-size: 3rem; opacity: 0.8;"></i>
                                </div>
                            {/if}
                        </div>

                        <!-- Asset info -->
                        <div class="p-2">
                            <div class="text-truncate small mb-2" title={asset?.filename || "Unnamed file"}>
                                {asset?.filename || "Unnamed file"}
                            </div>

                            <!-- Unlink button -->
                            <button
                                class="btn btn-sm btn-link text-danger p-0 text-decoration-none d-flex align-items-center gap-1"
                                type="button"
                                onclick={(e) => {
                                    e.stopPropagation();
                                    handleAssetRemove(objectAsset.asset.id);
                                }}
                            >
                                <i class="bi bi-dash-circle"></i>
                                <span class="small">
                                    {t("objects.linked_media.unlink", {
                                        fallback: "Unlink media",
                                    })}
                                </span>
                            </button>
                        </div>
                    </div>

                    <!-- Drag handle on the right -->
                    <div class="flex-shrink-0 d-flex align-items-center">
                        <button
                            class="btn btn-link text-muted p-1 drag-handle"
                            style="cursor: grab;"
                            aria-label="drag item"
                            use:dragHandle
                        >
                            <i class="bi bi-grip-vertical"></i>
                        </button>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <div class="text-center py-4 text-muted">
            <i class="bi bi-image fs-1 mb-2 d-block"></i>
            {t("objects.linked_media.no_media", {
                fallback: "No linked media",
            })}
        </div>
    {/if}
</div>

<!-- Hidden audio elements for playback -->
{#each displayAssets as objectAsset (objectAsset.id)}
    {@const asset = objectAsset.asset}
    {#if getAssetType(asset) === "audio"}
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
