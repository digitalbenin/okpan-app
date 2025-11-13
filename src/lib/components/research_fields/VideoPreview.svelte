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
    class="position-relative"
    style="width: {size}px; height: {size}px;"
>
    <!-- Remove Button -->
    {#if showRemoveButton}
        <button
            type="button"
            class="btn btn-sm btn-danger rounded-circle position-absolute d-flex align-items-center justify-content-center shadow-sm"
            style="width: 20px; height: 20px; padding: 0; top: -8px; left: -8px; z-index: 10;"
            onclick={handleRemove}
            title="Remove video"
            aria-label="Remove video"
        >
            <i class="bi bi-x" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Video Preview (Square) -->
    <div
        class="bg-light rounded overflow-hidden d-flex align-items-center justify-content-center position-relative w-100 h-100"
        style="cursor: pointer;"
        role="button"
        tabindex="0"
        onclick={handleClick}
        onkeydown={(e) => e.key === "Enter" && handleClick()}
    >
        <i class="bi bi-camera-video text-muted" style="font-size: 2rem;"></i>

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
