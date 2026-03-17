<script>
    import { onDestroy } from 'svelte';
    import { addImageProtocolPrefix } from '$lib/utils/media.js';

    let {
        src = null, 
        asset = null, 
        class: customClass = "",
        style: customStyle = "",
        controls = true,
        preload = "metadata",
        assetId = null,
        compact = false,
        element = $bindable(null),
        ontimeupdate = null,
        onloadedmetadata = null,
        onplay = null,
        onpause = null
    } = $props();

    let error = $state(false);
    let isDownloading = $state(false);
    let isMissing = $state(false);
    let retryKey = $state(0);
    let unsubscribeProgress = null;

    const smallPlaceholder = $derived(compact);

    const resolvedAssetId = $derived(asset?.id || assetId);

    const activeSrc = $derived.by(() => {
        if (asset && asset.path) {
            return addImageProtocolPrefix(asset.path);
        }
        return src ? addImageProtocolPrefix(src) : null;
    });

    const audioSource = $derived(retryKey > 0 && activeSrc ? (activeSrc.includes('?') ? `${activeSrc}&t=${retryKey}` : `${activeSrc}?t=${retryKey}`) : activeSrc);

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

                    if (element) {
                        setTimeout(() => {
                            if (element) element.load();
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

</script>

{#if isDownloading}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden rounded`}
        style={`min-height: 54px; ${customStyle}`}
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
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden rounded`}
        style={`min-height: 54px; ${customStyle}`}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center px-3">
            <i class={`bi bi-exclamation-circle ${smallPlaceholder ? '' : 'fs-4'}`}></i>
            {#if !smallPlaceholder}
                <span class="small">{isMissing ? 'Missing audio' : 'Error loading audio'}</span>
            {/if}
        </div>
    </div>
{:else if audioSource}
    <audio
        bind:this={element}
        src={audioSource}
        {controls}
        {preload}
        class={customClass}
        style={customStyle}
        onerror={onError}
        {ontimeupdate}
        {onloadedmetadata}
        {onplay}
        {onpause}
    ></audio>
{:else}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden rounded`}
        style={`min-height: 54px; ${customStyle}`}
    >
        <div class="d-flex flex-row align-items-center justify-content-center gap-2 opacity-50 px-3">
            <i class={`bi bi-music-note-beamed`}></i>
            {#if !compact}
                <span class="small">No audio</span>
            {/if}
        </div>
    </div>
{/if}