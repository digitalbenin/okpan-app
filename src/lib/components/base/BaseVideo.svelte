<script>
    import { onDestroy } from 'svelte';
    import { addImageProtocolPrefix } from '$lib/utils/media.js';

    let {
        src = null, // Explicit src as override/fallback
        asset = null, // Asset object
        class: customClass = "",
        style: customStyle = "",
        width,
        height,
        ratio,
        controls = true,
        preload = "metadata",
        assetId = null,
        compact = false
    } = $props();

    let error = $state(false);
    let isDownloading = $state(false);
    let isMissing = $state(false);
    let retryKey = $state(0);
    let unsubscribeProgress = null;

    let videoElement = $state();
    let posterDataUrl = $state(null);
    let lastProcessedSource = $state('');

    const resolvedAssetId = $derived(asset?.id || assetId);

    const activeSrc = $derived.by(() => {
        if (asset && asset.path) {
            return addImageProtocolPrefix(asset.path);
        }
        return src ? addImageProtocolPrefix(src) : null;
    });

    const videoSource = $derived(retryKey > 0 && activeSrc ? (activeSrc.includes('?') ? `${activeSrc}&t=${retryKey}` : `${activeSrc}?t=${retryKey}`) : activeSrc);

    const cleanupSubscription = () => {
        if (unsubscribeProgress) {
            unsubscribeProgress();
            unsubscribeProgress = null;
        }
    };

    const onError = (event) => {
        error = true;
        isMissing = true;
        
        if (resolvedAssetId && window.api?.onAssetSyncProgress && !unsubscribeProgress) {
            isDownloading = true;
            isMissing = false;
            
            unsubscribeProgress = window.api.onAssetSyncProgress((data) => {
                if (data.assetId !== resolvedAssetId) return;

                if (data.status === 'downloading') {
                    isDownloading = true;
                    isMissing = false;
                } else if (data.status === 'seeding' || data.status === 'available') {
                    isDownloading = false;
                    error = false;
                    isMissing = false;
                    retryKey = Date.now(); 
                    cleanupSubscription();

                    // Optional: force reload of video element src
                    if (videoElement) {
                        setTimeout(() => {
                            if (videoElement) videoElement.load();
                        }, 100);
                    }
                } else if (data.status === 'error' || data.status === 'missing') {
                    isDownloading = false;
                    isMissing = true;
                }
            });
        }
    };

    onDestroy(() => {
        cleanupSubscription();
    });

    const smallPlaceholder = $derived.by(() => {
        if (compact) return true;
        const w = width != null ? Number(width) : null;
        const h = height != null ? Number(height) : null;
        return (w != null && w < 200) || (h != null && h < 200);
    });

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
        if (videoSource && videoSource !== lastProcessedSource && !isDownloading && !error) {
            lastProcessedSource = videoSource;
            posterDataUrl = null;
            
            const vid = document.createElement('video');
            vid.src = videoSource;
            vid.crossOrigin = "anonymous";
            vid.muted = true;
            vid.playsInline = true;
            
            vid.addEventListener('loadeddata', () => {
                vid.currentTime = 0.1;
            }, { once: true });
            
            vid.addEventListener('seeked', () => {
                try {
                    if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                        const canvas = document.createElement('canvas');
                        canvas.width = vid.videoWidth;
                        canvas.height = vid.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                        posterDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    }
                } catch (err) {
                    console.error('Failed to extract video poster:', err);
                }
            }, { once: true });
        }
    });
</script>

{#if isDownloading}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden`}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} ${width ? `width: ${width}px;` : ''} ${height ? `height: ${height}px;` : ''} ${customStyle}`}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 w-100 px-4 text-center">
            <div class={`spinner-border text-secondary ${smallPlaceholder ? 'spinner-border-sm' : ''}`} role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            {#if !smallPlaceholder}
                <small class="text-secondary opacity-75 mt-1">Connecting to peers...</small>
            {/if}
        </div>
    </div>
{:else if error}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden`}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} ${width ? `width: ${width}px;` : ''} ${height ? `height: ${height}px;` : ''} ${customStyle}`}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center">
            <i class={`bi bi-exclamation-circle ${smallPlaceholder ? 'fs-3' : 'fs-1'}`}></i>
            {#if !smallPlaceholder}
                <span class="fs-6">{isMissing ? 'Missing video' : 'Error loading video'}</span>
            {/if}
        </div>
    </div>
{:else if videoSource}
    <!-- svelte-ignore a11y_media_has_caption -->
    <video
        bind:this={videoElement}
        src={videoSource}
        poster={posterDataUrl}
        {controls}
        {preload}
        width={width}
        height={height}
        class={customClass}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} ${customStyle}`}
        onerror={onError}
        aria-label={asset?.filename || asset?.name || "Video player"}
    >
        Your browser does not support the video tag.
    </video>
{:else}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden`}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} ${width ? `width: ${width}px;` : ''} ${height ? `height: ${height}px;` : ''} ${customStyle}`}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center">
            <i class={`bi bi-camera-video ${smallPlaceholder ? 'fs-3' : 'fs-1'}`}></i>
            {#if !smallPlaceholder}
                <span class="fs-6">No video</span>
            {/if}
        </div>
    </div>
{/if}