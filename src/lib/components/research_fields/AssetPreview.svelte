<script>
    import ImagePreview from "./ImagePreview.svelte";
    import VideoPreview from "./VideoPreview.svelte";
    import AudioPreview from "./AudioPreview.svelte";
    import MediaModal from "./MediaModal.svelte";

    let {
        asset = null,
        size = 150,
        class: customClass = "",
        onRemove = null,
        showRemoveButton = false,
    } = $props();

    let modalOpen = $state(false);
    let modalAsset = $state(null);

    // Function to determine asset type
    function getAssetType(assetData) {
        if (!assetData) return "unknown";

        // Check if asset has a specific media type property first
        if (
            assetData.type &&
            ["image", "video", "audio"].includes(assetData.type)
        ) {
            return assetData.type;
        }

        // Fallback to file extension
        const fileName = assetData.filename || assetData.name || "";
        const ext = fileName.split(".").pop()?.toLowerCase() || "";

        const imageExts = ["png", "jpg", "jpeg", "webp", "gif", "avif"];
        const videoExts = [
            "mp4",
            "webm",
            "mov",
            "avi",
            "mkv",
            "wmv",
            "flv",
            "m4v",
        ];
        const audioExts = ["mp3", "ogg", "wav", "m4a", "aac"];

        if (imageExts.includes(ext)) {
            return "image";
        }
        if (videoExts.includes(ext)) {
            return "video";
        }
        if (audioExts.includes(ext)) {
            return "audio";
        }

        return "unknown";
    }

    function handleMediaClick(clickedAsset) {
        modalAsset = clickedAsset;
        modalOpen = true;
    }

    function closeModal() {
        modalOpen = false;
        modalAsset = null;
    }

    const assetType = $derived(getAssetType(asset));
</script>

{#if asset}
    <div class="asset-preview {customClass}">
        {#if assetType === "image"}
            <ImagePreview
                {asset}
                {size}
                {showRemoveButton}
                {onRemove}
                onClick={handleMediaClick}
            />
        {:else if assetType === "video"}
            <VideoPreview
                {asset}
                {size}
                {showRemoveButton}
                {onRemove}
                onClick={handleMediaClick}
            />
        {:else if assetType === "audio"}
            <AudioPreview {asset} {size} {showRemoveButton} {onRemove} />
        {:else}
            <!-- Fallback for unknown file types -->
            <div
                class="unknown-file-preview bg-white rounded border p-3"
                style="width: {size}px;"
            >
                <div
                    class="d-flex align-items-center justify-content-center"
                    style="height: {size * 0.75}px;"
                >
                    <div class="text-center">
                        <i
                            class="bi bi-file-earmark text-muted"
                            style="font-size: 2rem;"
                        ></i>
                        <div class="mt-2 small text-muted">
                            Unknown file type
                        </div>
                    </div>
                </div>
                <div class="border-top p-2">
                    <div
                        class="d-flex align-items-center justify-content-between"
                    >
                        <span class="text-truncate small"
                            >{asset?.filename ||
                                asset?.name ||
                                "Unknown file"}</span
                        >
                        {#if showRemoveButton}
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-danger rounded-circle"
                                style="width: 24px; height: 24px; padding: 0;"
                                onclick={onRemove}
                                title="Remove file"
                                aria-label="Remove file"
                            >
                                <i class="bi bi-x" style="font-size: 12px;"></i>
                            </button>
                        {/if}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Media Modal -->
    <MediaModal asset={modalAsset} isOpen={modalOpen} onClose={closeModal} />
{/if}

<style>
    .asset-preview {
        display: inline-block;
        margin: 0.25rem;
    }

    .unknown-file-preview {
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
</style>
