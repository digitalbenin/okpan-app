<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import MediaModal from "$lib/components/research_fields/MediaModal.svelte";
    import LinkMediaModal from "$lib/components/objects/LinkMediaModal.svelte";
    import {
        unlinkAssetFromObject,
        reorderAssets,
        linkAssetToObject,
    } from "$lib/stores/ObjectsUtils.js";
    import { invalidate } from "$app/navigation";
    import { dragHandleZone, dragHandle } from "svelte-dnd-action";
    import { flip } from "svelte/animate";

    // Props
    const {
        object,
        // When creating a new object, parent can pass route project/institution
        projectId = null,
        institutionId = null,
        onChangesUpdate = null, // Callback to notify parent of changes
    } = $props();

    const { t } = getTranslationStore();

    // Get object's linked assets
    const linkedAssets = $derived(object?.objectsAssets || []);

    // Track pending changes for removal
    let pendingRemovals = $state(new Set());

    // Track pending additions (assets selected in modal but not yet saved)
    let pendingAdditions = $state([]); // array of asset objects

    // Track reordered assets locally for immediate visual feedback
    let reorderedAssets = $state([]);
    let hasReorderChanges = $state(false);

    // Animation duration for flip animations
    const flipDurationMs = 200;

    // Modal state for media preview
    let isModalOpen = $state(false);
    let modalAsset = $state(null);

    // Modal state for linking media
    let isLinkModalOpen = $state(false);

    // Audio elements map for controlling playback
    let audioElements = new Map();

    // Helper function to notify parent
    function notifyParent() {
        if (onChangesUpdate) {
            onChangesUpdate({
                component: "linked_media",
                hasChanges:
                    pendingRemovals.size > 0 ||
                    hasReorderChanges ||
                    (pendingAdditions && pendingAdditions.length > 0),
                changes: {
                    removals: Array.from(pendingRemovals),
                    reorders: hasReorderChanges ? reorderedAssets : null,
                    additions: pendingAdditions?.map((a) => a.id) || [],
                },
                saveFunction: saveChanges,
            });
        }
    }

    // Handle asset removal (mark for removal, don't remove immediately)
    function handleAssetRemove(assetId) {
        pendingRemovals.add(assetId);
        pendingRemovals = new Set(pendingRemovals);

        // Also remove from reorderedAssets if we have reorder changes
        if (hasReorderChanges) {
            reorderedAssets = reorderedAssets.filter(
                (asset) => asset.asset.id !== assetId,
            );
        }

        notifyParent();
    }

    // Get filtered and reordered assets (excluding those marked for removal)
    const displayAssets = $derived.by(() => {
        const filtered = linkedAssets.filter(
            (objectAsset) => !pendingRemovals.has(objectAsset.asset.id),
        );

        // Represent pending additions as objectAssets for UI/reorder
        const pendingAsObjectAssets = (pendingAdditions || []).map(
            (asset, idx) => ({
                id: `new-${asset.id}`,
                order: (filtered.length || 0) + idx + 1,
                asset,
                pending: true,
            }),
        );

        const baseList = [...filtered, ...pendingAsObjectAssets];

        // Use reordered assets if available, otherwise sort by order
        const assets = hasReorderChanges
            ? reorderedAssets
            : baseList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        return assets.map((objectAsset) => ({
            ...objectAsset,
            id: objectAsset.id,
        }));
    });

    // Handle adding media: open selection modal
    function handleAddMedia() {
        isLinkModalOpen = true;
    }

    // Handle viewing media
    function handleViewMedia(asset) {
        const assetType = getAssetType(asset);

        if (assetType === "audio") {
            handleAudioToggle(asset);
        } else {
            // Open modal for images and videos
            modalAsset = asset;
            isModalOpen = true;
        }
    }

    // Handle audio play/pause
    function handleAudioToggle(asset) {
        const audioElement = audioElements.get(asset.id);

        if (audioElement) {
            if (audioElement.paused) {
                // Pause all other audio first
                audioElements.forEach((audio, id) => {
                    if (id !== asset.id && !audio.paused) {
                        audio.pause();
                    }
                });
                audioElement.play().catch((error) => {
                    console.error("Error playing audio:", error);
                });
            } else {
                audioElement.pause();
            }
        }
    }

    // Get asset type based on file extension or type property
    function getAssetType(asset) {
        const type = asset.type?.toLowerCase();
        const filename = asset.filename?.toLowerCase() || "";

        if (
            type === "audio" ||
            filename.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/)
        ) {
            return "audio";
        } else if (
            type === "video" ||
            filename.match(/\.(mp4|webm|mov|avi|mkv)$/)
        ) {
            return "video";
        } else if (
            type === "image" ||
            filename.match(/\.(jpg|jpeg|png|gif|webp|avif)$/)
        ) {
            return "image";
        }
        return "unknown";
    }

    // Close modal
    function closeModal() {
        isModalOpen = false;
        modalAsset = null;
    }

    // Action to register audio elements
    function registerAudioElement(element, assetId) {
        audioElements.set(assetId, element);

        return {
            destroy() {
                audioElements.delete(assetId);
            },
        };
    }

    // Save all pending changes
    async function saveChanges(objectIdToSave) {
    if (
        pendingRemovals.size === 0 &&
        !hasReorderChanges &&
        (!pendingAdditions || pendingAdditions.length === 0)
    )
        return;

    const objectId = objectIdToSave || object?.id;
    if (!objectId) {
        console.error("No object ID provided to save asset changes.");
        return;
    }

    try {
        const promises = [];

        // 1) Execute link operations first (new additions)
        if (pendingAdditions && pendingAdditions.length > 0) {
            const currentCount = linkedAssets.filter(
                (oa) => !pendingRemovals.has(oa.asset.id),
            ).length;
            const addPromises = pendingAdditions.map((asset, index) => {
                // Determine desired order. If we have reorder changes, find index in reorderedAssets
                let desiredOrder = currentCount + index + 1;
                if (hasReorderChanges) {
                    const pos = reorderedAssets.findIndex(
                        (item) => item.asset.id === asset.id,
                    );
                    desiredOrder = pos >= 0 ? pos + 1 : desiredOrder;
                }
                return linkAssetToObject(objectId, asset.id, desiredOrder);
            });
            promises.push(...addPromises);
        }

        // 2) Execute removal operations
        if (pendingRemovals.size > 0) {
            const removePromises = Array.from(pendingRemovals).map((assetId) =>
                unlinkAssetFromObject(objectId, assetId),
            );
            promises.push(...removePromises);
        }

        // 3) Execute reorder operations (for existing + newly linked)
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
                // Clear pending changes
                pendingRemovals.clear();
                pendingRemovals = new Set(pendingRemovals);
                pendingAdditions = [];
                notifyParent();

                // Refresh data then clear reorder state to prevent flickering
                await invalidate("custom:object");
                reorderedAssets = [];
                hasReorderChanges = false;
            }
        } catch (error) {
            console.error("Error saving asset changes:", error);
        }
    }

    // Handle drag and drop events
    function handleDndEvent(event) {
        reorderedAssets = [...event.detail.items];
        hasReorderChanges = true;
        notifyParent();
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
        <BaseButton
            class="btn btn-outline-secondary"
            icon="plus"
            text={t("objects.linked_media.link_media", {
                fallback: "Link media",
            })}
            onClick={handleAddMedia}
        />
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
                    class="d-flex align-items-center gap-3 mb-3 p-3 bg-white border border-secondary border-opacity-25 rounded"
                    animate:flip={{ duration: flipDurationMs }}
                >
                    <!-- Asset thumbnail -->
                    <div
                        class="flex-shrink-0"
                        style="cursor: pointer;"
                        role="button"
                        tabindex="0"
                        onclick={() => handleViewMedia(asset)}
                        onkeydown={(e) =>
                            e.key === "Enter" && handleViewMedia(asset)}
                    >
                        <BaseImage
                            src={asset?.path ? `media://${asset.path}` : null}
                            alt={asset?.filename || "Asset"}
                            width={64}
                            height={64}
                            class="rounded"
                            ratio="1/1"
                        />
                    </div>

                    <!-- Asset info -->
                    <div class="flex-grow-1 min-w-0 me-3 overflow-hidden">
                        <div
                            class="fw-medium text-truncate"
                            style="cursor: pointer;"
                            role="button"
                            tabindex="0"
                            onclick={() => handleViewMedia(asset)}
                            onkeydown={(e) =>
                                e.key === "Enter" && handleViewMedia(asset)}
                        >
                            {asset?.filename || "Unnamed file"}
                        </div>
                        {#if asset?.type}
                            <small class="text-muted">
                                {asset.type.toUpperCase()}
                            </small>
                        {/if}
                    </div>

                    <!-- Actions -->
                    <div class="flex-shrink-0 d-flex align-items-center gap-1">
                        <!-- Drag handle -->
                        <button
                            class="btn btn-link text-muted p-1 drag-handle"
                            style="cursor: grab;"
                            aria-label="drag item"
                            use:dragHandle
                            ><i class="bi bi-grip-vertical"></i>
                        </button>
                        <!-- Unlink button -->
                        <button
                            class="btn btn-link text-danger p-1"
                            type="button"
                            aria-label={t("objects.linked_media.unlink", {
                                fallback: "Unlink media",
                            })}
                            title={t("objects.linked_media.unlink", {
                                fallback: "Unlink media",
                            })}
                            onclick={(e) => {
                                e.stopPropagation();
                                handleAssetRemove(objectAsset.asset.id);
                            }}
                        >
                            <i class="bi bi-dash-circle"></i>
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
    initiallySelectedIds={[
        ...linkedAssets.map((oa) => oa.asset.id),
        ...(pendingAdditions || []).map((a) => a.id),
    ]}
    onClose={() => (isLinkModalOpen = false)}
    onSave={(selectedAssets) => {
        // Only keep assets that are not already linked
        const existingIds = new Set(linkedAssets.map((oa) => oa.asset.id));
        pendingAdditions = selectedAssets.filter((a) => !existingIds.has(a.id));

        // If we already had a manual reorder, incorporate new items into list
        if (hasReorderChanges) {
            const base = displayAssets;
            const newItems = pendingAdditions.map((asset) => ({
                id: `new-${asset.id}`,
                order: (base.length || 0) + 1,
                asset,
                pending: true,
            }));
            reorderedAssets = [...base, ...newItems];
        }
        notifyParent();
    }}
/>
