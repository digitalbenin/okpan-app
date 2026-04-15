<script>
    import { getMediaType } from "$lib/utils/media.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import ImagePreview from "./ImagePreview.svelte";
    import VideoPreview from "./VideoPreview.svelte";
    import AudioPreview from "./AudioPreview.svelte";
    import MediaModal from "./MediaModal.svelte";

    let {
        asset = null,
        size = 150,
        width = undefined,
        class: customClass = "",
        onRemove = null,
        showRemoveButton = false,
    } = $props();

    let modalOpen = $state(false);
    let modalAsset = $state(null);
    const { t } = getTranslationStore();

    function handleMediaClick(clickedAsset) {
        modalAsset = clickedAsset;
        modalOpen = true;
    }

    function closeModal() {
        modalOpen = false;
        modalAsset = null;
    }

    const assetType = $derived(getMediaType(asset));
</script>

{#if asset}
    <div class="asset-preview {customClass}" style="max-width: 100%;">
        {#if assetType === "image"}
            <ImagePreview
                {asset}
                {size}
                {width}
                {showRemoveButton}
                {onRemove}
                onClick={handleMediaClick}
            />
        {:else if assetType === "video"}
            <VideoPreview
                {asset}
                {size}
                {width}
                {showRemoveButton}
                {onRemove}
                onClick={handleMediaClick}
            />
        {:else if assetType === "audio"}
            <AudioPreview {asset} {size} {width} {showRemoveButton} {onRemove} />
        {:else}
            <!-- Fallback for unknown file types -->
            <div
                class="unknown-file-preview bg-white rounded border p-3"
                style="width: {width ?? size + 'px'};"
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
                            {t("media.unknown-file-type", { fallback: "Unknown file type" })}
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
                                t("media.unknown-file", { fallback: "Unknown file" })}</span
                        >
                        {#if showRemoveButton}
                            <button
                                type="button"
                                class="btn btn-sm btn-outline-danger rounded-circle"
                                style="width: 24px; height: 24px; padding: 0;"
                                onclick={onRemove}
                                title={t("media.remove-file", { fallback: "Remove file" })}
                                aria-label={t("media.remove-file", { fallback: "Remove file" })}
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
