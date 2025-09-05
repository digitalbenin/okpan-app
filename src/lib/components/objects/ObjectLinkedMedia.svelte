<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import MediaModal from "$lib/components/research_fields/MediaModal.svelte";
    import { unlinkAssetFromObject } from "$lib/stores/ObjectsUtils.js";
    import { invalidate } from "$app/navigation";

    // Props
    const {
        object,
        onChangesUpdate = null, // Callback to notify parent of changes
    } = $props();

    const { t } = getTranslationStore();

    // Get object's linked assets
    const linkedAssets = $derived(object?.objectsAssets || []);

    // Track pending changes for removal
    let pendingRemovals = $state(new Set());

    // Modal state for media preview
    let isModalOpen = $state(false);
    let modalAsset = $state(null);

    // Audio elements map for controlling playback
    let audioElements = new Map();

    // Helper function to notify parent
    function notifyParent() {
        if (onChangesUpdate) {
            onChangesUpdate({
                component: "linked_media",
                hasChanges: pendingRemovals.size > 0,
                changes: Array.from(pendingRemovals),
                saveFunction: saveChanges,
            });
        }
    }

    // Handle asset removal (mark for removal, don't remove immediately)
    function handleAssetRemove(assetId) {
        pendingRemovals.add(assetId);
        pendingRemovals = new Set(pendingRemovals);
        notifyParent();
    }

    // Get filtered assets (excluding those marked for removal)
    const displayAssets = $derived(
        linkedAssets.filter(
            (objectAsset) => !pendingRemovals.has(objectAsset.asset.id),
        ),
    );

    // Handle adding media (placeholder for now)
    function handleAddMedia() {
        // TODO: Implement media linking functionality
        console.log("Add media clicked - functionality to be implemented");
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
    async function saveChanges() {
        if (pendingRemovals.size === 0) return;

        try {
            const removePromises = Array.from(pendingRemovals).map((assetId) =>
                unlinkAssetFromObject(object.id, assetId),
            );

            const results = await Promise.all(removePromises);

            // Check for errors
            const errors = results.filter((result) => result.error);
            if (errors.length > 0) {
                console.error("Error removing assets:", errors);
                // TODO: Show user error message
            } else {
                // Clear pending removals
                pendingRemovals.clear();
                pendingRemovals = new Set(pendingRemovals);

                // Notify parent that changes are cleared
                notifyParent();

                // Invalidate to refresh data
                invalidate("custom:object");
            }
        } catch (error) {
            console.error("Error saving asset changes:", error);
        }
    }
</script>

<div class="bg-white p-4">
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
        <div class="linked-assets">
            {#each displayAssets as objectAsset (objectAsset.id)}
                {@const asset = objectAsset.asset}
                <div
                    class="d-flex align-items-center gap-3 mb-3 p-3 border border-secondary border-opacity-25 rounded"
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
                    <div class="flex-shrink-0">
                        <!-- Unlink button -->
                        <BaseButton
                            class="btn btn-link text-danger p-1"
                            icon="dash-circle"
                            text=""
                            title={t("objects.linked_media.unlink", {
                                fallback: "Unlink media",
                            })}
                            onClick={() =>
                                handleAssetRemove(objectAsset.asset.id)}
                        />
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
