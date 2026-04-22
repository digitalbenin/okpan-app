<script>
    import { getAssetUrl } from '$lib/utils/imgUtils.js';

    let {
        src = null,
        asset = null,
        class: customClass = '',
        style: customStyle = '',
        width,
        height,
        ratio,
        controls = true,
        preload = 'metadata',
        assetId = null,
        projectId = null,
        compact = false
    } = $props();

    let hasError = $state(false);
    let videoElement = $state(null);

    function normalizePath(path) {
        if (!path) return '';
        if (/^(?:data:|blob:|https?:|media:)/i.test(path)) return path;
        return getAssetUrl({ asset_path: path });
    }

    const resolvedPath = $derived.by(() => asset?.path || asset?.asset_path || src || '');
    const videoSource = $derived(normalizePath(resolvedPath));
    const isCompact = $derived.by(() => {
        if (compact) return true;
        const numericWidth = width != null ? Number(width) : null;
        const numericHeight = height != null ? Number(height) : null;
        return (numericWidth != null && numericWidth < 200) || (numericHeight != null && numericHeight < 200);
    });
    const wrapperStyle = $derived.by(() => {
        const parts = [];
        if (ratio) parts.push(`aspect-ratio: ${ratio};`);
        if (width) parts.push(`width: ${width}px;`);
        if (height) parts.push(`height: ${height}px;`);
        if (customStyle) parts.push(customStyle);
        return parts.join(' ');
    });

    function handleError() {
        hasError = true;
    }

    export function focus() {
        if (videoElement) {
            videoElement.focus();
        }
    }

    export function play() {
        if (videoElement) {
            return videoElement.play();
        }
    }

    export function pause() {
        if (videoElement) {
            videoElement.pause();
        }
    }

    $effect(() => {
        videoSource;
        hasError = false;
    });
</script>

{#if videoSource && !hasError}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        bind:this={videoElement}
        src={videoSource}
        {controls}
        {preload}
        {width}
        {height}
        class={customClass}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} ${customStyle}`}
        onerror={handleError}
        aria-label={asset?.filename || asset?.name || 'Video player'}
    >
        Your browser does not support the video tag.
    </video>
{:else}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden`}
        style={wrapperStyle}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center">
            <i class={`bi bi-camera-video ${isCompact ? 'fs-3' : 'fs-1'}`}></i>
            {#if !isCompact}
                <span class="fs-6">{hasError ? 'Error loading video' : 'No video'}</span>
            {/if}
        </div>
    </div>
{/if}