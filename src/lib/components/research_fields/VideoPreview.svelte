<script>
    import { IconX, IconVideo, IconPlayerPlayFilled } from "@tabler/icons-svelte";
    import BaseVideo from "$lib/components/base/BaseVideo.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    let {
        asset,
        size = 200,
        width = undefined,
        showRemoveButton = false,
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
            class="btn btn-sm bg-white  text-dark rounded-circle position-absolute d-flex align-items-center justify-content-center border-0 opacity-0-hover-100 transition-opacity"
            style="width: 28px; height: 28px; padding: 0; top: 8px; right: 8px; z-index: 10;"
            onclick={handleRemove}
            title={t("media.remove-video", { fallback: "Remove video" })}
            aria-label={t("media.remove-video", { fallback: "Remove video" })}
        >
            <IconX size={14} />
        </button>
    {/if}

    <!-- Video Preview -->
    <div
        class="bg-light d-flex align-items-center justify-content-center position-relative w-100 flex-grow-1 custom-video-container"
        style="cursor: pointer; min-height: 0;"
        role="button"
        tabindex="0"
        onclick={handleClick}
        onkeydown={(e) => e.key === "Enter" && handleClick()}
    >
        {#if asset?.path}
            <BaseVideo
                {asset}
                controls={false}
                class="w-100 h-100 object-fit-cover"
                style="pointer-events: none;"
                compact={true}
            />
        {:else}
            <IconVideo size={32} class="text-muted" />
        {/if}

        <!-- Play Button Overlay -->
        <div
            class="position-absolute d-flex align-items-center justify-content-center  hover-opacity-100"
            style="top: 0; left: 0; right: 0; bottom: 0;"
        >
            <div
                class="bg-white  rounded-circle d-flex align-items-center justify-content-center transition-transform"
                style="width: 40px; height: 40px;"
            >
                <IconPlayerPlayFilled size={16} class="text-dark" style="margin-left: 2px;" />
            </div>
        </div>
    </div>

    <!-- Asset name bar -->
    <div class="bg-white p-2 flex-shrink-0">
        <span class="text-truncate small d-block">{asset.filename || asset.name || ""}</span>
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
