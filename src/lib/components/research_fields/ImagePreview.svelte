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
            class="btn btn-sm btn-dark bg-opacity-75 text-white rounded-circle position-absolute d-flex align-items-center justify-content-center border-0 opacity-0-hover-100 transition-opacity"
            style="width: 22px; height: 22px; padding: 0; top: 5px; right: 5px; z-index: 10;"
            onclick={handleRemove}
            title="Remove image"
            aria-label="Remove image"
        >
            <i class="bi bi-x-lg" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Image Preview (Square) -->
    <div
        class="bg-light rounded overflow-hidden d-flex align-items-center justify-content-center w-100 h-100"
        style="cursor: pointer;"
        role="button"
        tabindex="0"
        onclick={handleClick}
        onkeydown={(e) => e.key === "Enter" && handleClick()}
    >
        {#if asset?.path}
            <img
                src="media://{asset.path}"
                alt={asset.filename || asset.name}
                class="w-100 h-100 object-fit-cover"
                loading="lazy"
            />
        {:else}
            <i class="bi bi-image text-muted" style="font-size: 2rem;"></i>
        {/if}
    </div>
</div>

<style>
    .object-fit-cover {
        object-fit: cover;
    }
</style>
