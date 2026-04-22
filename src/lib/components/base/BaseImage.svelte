<script>
    import { page } from '$app/state';
    import { onDestroy } from 'svelte';
    import { parseAssetFormats, addImageProtocolPrefix } from '$lib/utils/media.js';

    let {
        src = null, // Explicit src as override/fallback
        asset = null, // Asset object
        preferredFormat = 'sm', // Preferred image format locally
        alt,
        width,
        height,
        class: customClass = "", // Add class prop with default empty string
        style: customStyle = "", // Add style prop with default empty string
        placeholder,
        objectFit = "cover",
        ratio,
        objectPosition = "center",
        loading = "lazy",
        assetId = null, // Added for optimistic loading pattern
        projectId = null,
        compact = false // Force compact mode for placeholders
    } = $props();

    let error = $state(false);
    let isDownloading = $state(false);
    let retryKey = $state(0);
    let unsubscribeProgress = null;
    let fallbackLevel = $state(0); // 0: Preferred, 1: Original asset
    let requestedRecoveryKey = $state(null);

    const resolvedAssetId = $derived(asset?.id || assetId);
    const resolvedProjectId = $derived(
        projectId || asset?.project_id || page.params?.project_id || page.url?.searchParams?.get('project_id') || null
    );

    // Dynamically retrieve the image URL with fallback to the local Original Path
    const activeSrc = $derived.by(() => {
        if (fallbackLevel === 0 && asset) {
            const formats = parseAssetFormats(asset.formats);
            if (formats) {
                // Try preferred format or standard fallback sequence
                const target = formats[preferredFormat] || formats.sm || formats.md || formats.lg || formats.thumbnail || formats.original;
                if (target) {
                    return addImageProtocolPrefix(target);
                }
            }
        }
        
        // Fallback Level 1: Original asset path (always exists if we have an asset)
        if (fallbackLevel <= 1 && asset && asset.path) {
            return addImageProtocolPrefix(asset.path);
        }

        // Lastly, explicit src provided to the component
        return src ? addImageProtocolPrefix(src) : null;
    });

    // Derived image source with cache-busting on retry
    const imgSource = $derived(retryKey > 0 && activeSrc ? (activeSrc.includes('?') ? `${activeSrc}&t=${retryKey}` : `${activeSrc}?t=${retryKey}`) : activeSrc);

    const cleanupSubscription = () => {
        if (unsubscribeProgress) {
            unsubscribeProgress();
            unsubscribeProgress = null;
        }
    };

    const requestRecovery = async () => {
        const recoveryKey = resolvedProjectId && resolvedAssetId ? `${resolvedProjectId}:${resolvedAssetId}` : null;
        if (!recoveryKey || requestedRecoveryKey === recoveryKey || !window.api?.triggerAssetReconcile) {
            return;
        }

        requestedRecoveryKey = recoveryKey;

        try {
            await window.api.triggerAssetReconcile(resolvedProjectId, resolvedAssetId);
        } catch (err) {
            console.error('[BaseImage] Failed to request asset reconcile:', err);
        }
    };

    const onError = (event) => {
        // Fallback Step 1: If preferred format threw 404, we immediately try the original file on disk
        if (fallbackLevel === 0 && asset && asset.path) {
            fallbackLevel = 1;
            return;
        }

        // Fallback Step 2: Everything failed. Asset not physically available.
        error = true;
        requestRecovery();
        
        // Optimistic Loading Fallback
        // Only subscribe to backend IPC if the initial load failed and we have an tracking ID.
        if (resolvedAssetId && window.api?.onAssetSyncProgress && !unsubscribeProgress) {
            isDownloading = true; // Assume waiting for it to be downloaded
            
            unsubscribeProgress = window.api.onAssetSyncProgress((data) => {
                if (data.assetId !== resolvedAssetId) return;

                if (data.status === 'downloading') {
                    isDownloading = true;
                } else if (data.status === 'seeding' || data.status === 'available') {
                    // Image is now available on disk
                    isDownloading = false;
                    error = false;
                    fallbackLevel = 0; // Reset fallback so it can potentially grab fully-completed formats
                    requestedRecoveryKey = null;
                    retryKey = Date.now(); // Cache-bust to force reload
                    cleanupSubscription();
                } else if (data.status === 'error' || data.status === 'missing') {
                    isDownloading = false; // Missing but retrying or failed completely
                }
            });
        }
    };

    onDestroy(() => {
        cleanupSubscription();
    });

    // Determine if placeholder should be compact (icon only) for small sizes
    const smallPlaceholder = $derived.by(() => {
        if (compact) return true;
        const w = width != null ? Number(width) : null;
        const h = height != null ? Number(height) : null;
        return (w != null && w < 200) || (h != null && h < 200);
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
                <span class="fs-6">Error loading image</span>
            {/if}
        </div>
    </div>
{:else if imgSource}
    <img
        src={imgSource}
        {alt}
        width={width}
        height={height}
        class={customClass}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} object-fit: ${objectFit}; object-position: ${objectPosition}; ${customStyle}`}
        {loading}
        {placeholder}
        onerror={onError}
    />
{:else}
    <div
        class={`${customClass} bg-light d-flex align-items-center justify-content-center overflow-hidden`}
        style={`${ratio ? `aspect-ratio: ${ratio};` : ''} ${width ? `width: ${width}px;` : ''} ${height ? `height: ${height}px;` : ''} ${customStyle}`}
    >
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center">
            <i class={`bi bi-image ${smallPlaceholder ? 'fs-3' : 'fs-1'}`}></i>
            {#if !smallPlaceholder}
                <span class="fs-6">No image</span>
            {/if}
        </div>
    </div>
{/if}
