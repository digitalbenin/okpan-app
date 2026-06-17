<script>
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    let {
        asset,
        size = 200,
        width = undefined,
        showRemoveButton = false,
        showFilename = true,
        onRemove = null,
        onClick = null,
    } = $props();

    const { t } = getTranslationStore();

    function handleClick() {
        if (onClick) {
            onClick(asset);
        }
    }

    function handleRemove(e) {
        e.stopPropagation();
        if (onRemove) {
            onRemove(asset);
        }
    }
</script>

<div
    class="position-relative d-flex flex-column rounded overflow-hidden"
    style="width: {width ?? size + 'px'}; height: {size}px; max-width: 100%;"
>
    <!-- Remove Button -->
    {#if showRemoveButton}
        <button
            type="button"
            class="btn btn-sm btn-dark bg-opacity-75 text-white rounded-circle position-absolute d-flex align-items-center justify-content-center border-0 opacity-0-hover-100 transition-opacity"
            style="width: 22px; height: 22px; padding: 0; top: 5px; right: 5px; z-index: 10;"
            onclick={handleRemove}
            title={t("media.remove-image", { fallback: "Remove image" })}
            aria-label={t("media.remove-image", { fallback: "Remove image" })}
        >
            <i class="bi bi-x-lg" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Image Preview -->
    <div
        class="bg-light d-flex align-items-center justify-content-center w-100 flex-grow-1"
        style="cursor: pointer; min-height: 0;"
        role="button"
        tabindex="0"
        onclick={handleClick}
        onkeydown={(e) => e.key === "Enter" && handleClick()}
    >
        {#if asset?.path}
            <BaseImage
                {asset}
                preferredFormat="md"
                alt={asset.filename || asset.name}
                class="w-100 h-100"
                objectFit="cover"
                loading="lazy"
                compact={true}
            />
        {:else}
            <i class="bi bi-image text-muted" style="font-size: 2rem;"></i>
        {/if}
    </div>

    <!-- Asset name bar -->
    {#if showFilename}
    <div class="bg-white p-2 flex-shrink-0">
        <span class="text-truncate small d-block">{asset.filename || asset.name || ""}</span>
    </div>
    {/if}
</div>
