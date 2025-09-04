<script>
    let {
        asset,
        size = 200,
        showRemoveButton = false,
        onRemove = null,
        onClick = null,
    } = $props();

    function handleClick() {
        if (onClick) {
            onClick(asset);
        }
    }

    function handleRemove(e) {
        e.stopPropagation();
        if (onRemove) {
            onRemove();
        }
    }
</script>

<div
    class="border border-secondary border-opacity-50 bg-light rounded position-relative"
    style="width: {size}px; height: {size}px;"
>
    <!-- Remove Button -->
    {#if showRemoveButton}
        <button
            type="button"
            class="btn btn-sm btn-danger rounded-circle position-absolute d-flex align-items-center justify-content-center shadow-sm"
            style="width: 20px; height: 20px; padding: 0; top: -8px; right: -8px; z-index: 10;"
            on:click={handleRemove}
            title="Remove video"
        >
            <i class="bi bi-x" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Video Header with filename -->
    <div
        class="px-2 py-1 d-flex align-items-center gap-2 bg-secondary-subtle border-bottom"
    >
        <i class="bi bi-camera-video text-muted" style="font-size: 14px;"></i>
        <span
            class="text-dark fw-medium flex-grow-1 text-truncate lh-sm"
            style="font-size: 12px;"
            title={asset?.filename || asset?.name || "video.mp4"}
        >
            {asset?.filename || asset?.name || "video.mp4"}
        </span>
    </div>

    <!-- Video Thumbnail/Preview Area -->
    <div
        class="bg-white d-flex align-items-center justify-content-center position-relative overflow-hidden"
        style="height: {size - 40}px; cursor: pointer;"
        role="button"
        tabindex="0"
        on:click={handleClick}
        on:keydown={(e) => e.key === "Enter" && handleClick()}
    >
        <!-- Video thumbnail placeholder with border -->
        <div
            class="bg-light border border-2 border-dashed border-secondary border-opacity-50 rounded d-flex align-items-center justify-content-center position-relative"
            style="width: 120px; height: 80px;"
        >
            <i class="bi bi-camera-video text-muted" style="font-size: 32px;"
            ></i>

            <!-- Play Button Overlay -->
            <div
                class="position-absolute d-flex align-items-center justify-content-center opacity-75 hover-opacity-100"
                style="top: 0; left: 0; right: 0; bottom: 0;"
            >
                <div
                    class="bg-dark bg-opacity-75 rounded-circle d-flex align-items-center justify-content-center transition-transform"
                    style="width: 40px; height: 40px;"
                >
                    <i
                        class="bi bi-play-fill text-white"
                        style="font-size: 16px; margin-left: 2px;"
                    ></i>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    /* Custom hover effects that complement Bootstrap */
    .hover-opacity-100:hover {
        opacity: 1 !important;
    }

    .transition-transform {
        transition: transform 0.2s ease;
    }

    .transition-transform:hover {
        transform: scale(1.1);
    }
</style>
