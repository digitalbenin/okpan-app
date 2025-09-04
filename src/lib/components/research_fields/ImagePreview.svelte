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
            title="Remove image"
        >
            <i class="bi bi-x" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Image Header with filename -->
    <div
        class="px-2 py-1 d-flex align-items-center gap-2 bg-secondary-subtle border-bottom"
    >
        <i class="bi bi-image text-muted" style="font-size: 14px;"></i>
        <span
            class="text-dark fw-medium flex-grow-1 text-truncate lh-sm"
            style="font-size: 12px;"
            title={asset?.filename || asset?.name || "image.jpg"}
        >
            {asset?.filename || asset?.name || "image.jpg"}
        </span>
    </div>

    <!-- Image Preview Area -->
    <div
        class="bg-white d-flex align-items-center justify-content-center position-relative overflow-hidden"
        style="height: {size - 32}px; width: {size -
            8}px; margin: 0 auto; cursor: pointer;"
        role="button"
        tabindex="0"
        on:click={handleClick}
        on:keydown={(e) => e.key === "Enter" && handleClick()}
    >
        {#if asset?.path}
            <img
                src="media://{asset.path}"
                alt={asset.filename || asset.name}
                class="w-100 h-100 object-fit-contain"
                loading="lazy"
            />
        {:else}
            <div
                class="bg-light border border-2 border-dashed border-secondary border-opacity-50 rounded d-flex align-items-center justify-content-center"
                style="width: 120px; height: 80px;"
            >
                <i class="bi bi-image text-muted" style="font-size: 32px;"></i>
            </div>
        {/if}
    </div>
</div>

<style>
    .object-fit-cover {
        object-fit: cover;
    }
</style>
