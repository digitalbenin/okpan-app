<script>
    import { addImageProtocolPrefix } from "$lib/utils/images.js";

    let {
        asset = null,
        size = 150,
        class: customClass = "",
        onRemove = null,
        showRemoveButton = false,
    } = $props();

    // Function to get the best preview format (prefer smallest for performance)
    function getPreviewSrc(assetData) {
        if (!assetData) return null;

        // For edit mode - asset has formats object with sm/md/original
        if (assetData.formats) {
            try {
                const formats =
                    typeof assetData.formats === "string"
                        ? JSON.parse(assetData.formats)
                        : assetData.formats;

                // Prefer smallest format for preview (sm = 300px)
                const formatUrl = formats.sm || formats.md || formats.original;
                return formatUrl ? addImageProtocolPrefix(formatUrl) : null;
            } catch (e) {
                console.error("Error parsing asset formats:", e);
                return assetData.path
                    ? addImageProtocolPrefix(assetData.path)
                    : null;
            }
        }

        // For new uploads - just has path
        if (assetData.path) {
            return addImageProtocolPrefix(assetData.path);
        }

        return null;
    }

    // Function to get display name
    function getDisplayName(assetData) {
        if (!assetData) return "";
        return assetData.filename || assetData.name || "Unknown file";
    }

    // Function to determine if it's an image
    function isImage(assetData) {
        if (!assetData) return false;

        const fileName = assetData.filename || assetData.name || "";
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        const imageExts = ["png", "jpg", "jpeg", "webp", "gif", "avif"];
        return imageExts.includes(ext);
    }

    // Get preview source
    const previewSrc = $derived(getPreviewSrc(asset));
    const displayName = $derived(getDisplayName(asset));
    const isImageFile = $derived(isImage(asset));
</script>

{#if asset}
    <div
        class="asset-preview {customClass}"
        style="width: {size}px; height: {size}px;"
    >
        <div class="preview-container">
            {#if isImageFile && previewSrc}
                <!-- Image preview -->
                <img
                    src={previewSrc}
                    alt={displayName}
                    class="preview-image"
                    loading="lazy"
                    style="width: {size}px; height: {size}px;"
                />
            {:else}
                <!-- Non-image file icon -->
                <div
                    class="file-icon-container"
                    style="width: {size}px; height: {size}px;"
                >
                    <i
                        class="bi bi-file-earmark"
                        style="font-size: {size * 0.4}px;"
                    ></i>
                </div>
            {/if}

            <!-- Remove button overlay -->
            {#if showRemoveButton && onRemove}
                <button
                    type="button"
                    class="btn btn-danger btn-sm remove-btn"
                    onclick={onRemove}
                    title="Remove asset"
                    aria-label="Remove asset"
                >
                    <i class="bi bi-x"></i>
                </button>
            {/if}
        </div>

        <!-- File name caption -->
        <div class="file-name" title={displayName}>
            {displayName}
        </div>
    </div>
{/if}

<style>
    .asset-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        margin: 0.25rem;
    }

    .preview-container {
        position: relative;
        border: 1px solid #dee2e6;
        border-radius: 0.375rem;
        overflow: hidden;
        background-color: #f8f9fa;
    }

    .preview-image {
        object-fit: cover;
        border-radius: 0.375rem;
    }

    .file-icon-container {
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6c757d;
        border-radius: 0.375rem;
    }

    .remove-btn {
        position: absolute;
        top: 0.25rem;
        right: 0.25rem;
        width: 1.5rem;
        height: 1.5rem;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        opacity: 0.8;
    }

    .remove-btn:hover {
        opacity: 1;
    }

    .file-name {
        font-size: 0.75rem;
        color: #6c757d;
        text-align: center;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
</style>
