<script>
    import { page } from '$app/state';
    import { onDestroy } from 'svelte';
    import { addImageProtocolPrefix } from '$lib/utils/media.js';

    let {
        asset,
        size = 200,
        width = undefined,
        showRemoveButton = false,
        onRemove = null,
    } = $props();

    let audioElement;
    let isPlaying = $state(false);
    let currentTime = $state(0);
    let duration = $state(0);
    let isLoaded = $state(false);
    let isDownloading = $state(false);
    let isMissing = $state(false);
    let retryKey = $state(0);
    let unsubscribeProgress = null;
    let requestedRecoveryKey = $state(null);

    const resolvedAssetId = $derived(asset?.id || null);
    const resolvedProjectId = $derived(asset?.project_id || page.params?.project_id || page.url?.searchParams?.get('project_id') || null);
    const audioSource = $derived.by(() => {
        if (!asset?.path) return null;
        const baseSrc = addImageProtocolPrefix(asset.path);
        return retryKey > 0
            ? (baseSrc.includes('?') ? `${baseSrc}&t=${retryKey}` : `${baseSrc}?t=${retryKey}`)
            : baseSrc;
    });

    const cleanupSubscription = () => {
        if (unsubscribeProgress) {
            unsubscribeProgress();
            unsubscribeProgress = null;
        }
    };

    async function requestRecovery() {
        const recoveryKey = resolvedProjectId && resolvedAssetId ? `${resolvedProjectId}:${resolvedAssetId}` : null;
        if (!recoveryKey || requestedRecoveryKey === recoveryKey || !window.api?.triggerAssetReconcile) {
            return;
        }

        requestedRecoveryKey = recoveryKey;

        try {
            await window.api.triggerAssetReconcile(resolvedProjectId, resolvedAssetId);
        } catch (err) {
            console.error('[AudioPreview] Failed to request asset reconcile:', err);
        }
    }

    function togglePlay(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!audioElement) {
            console.log("No audio element available");
            return;
        }

        console.log("Audio src:", audioElement.src);
        console.log("Asset path:", asset?.path);

        if (isPlaying) {
            audioElement.pause();
        } else {
            audioElement.play().catch((error) => {
                console.error("Error playing audio:", error);
            });
        }
    }

    function handleTimeUpdate() {
        if (audioElement) {
            currentTime = audioElement.currentTime;
        }
    }

    function handleLoadedMetadata() {
        if (audioElement) {
            duration = audioElement.duration;
            isLoaded = true;
            isMissing = false;
        }
    }

    function handlePlay() {
        isPlaying = true;
    }

    function handlePause() {
        isPlaying = false;
    }

    function handleError(e) {
        console.error("Audio error:", e);
        console.error("Audio element error:", audioElement?.error);
        isPlaying = false;
        isLoaded = false;
        isMissing = true;
        requestRecovery();

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
                    isMissing = false;
                    requestedRecoveryKey = null;
                    retryKey = Date.now();
                    cleanupSubscription();

                    if (audioElement) {
                        setTimeout(() => {
                            if (audioElement) audioElement.load();
                        }, 100);
                    }
                } else if (data.status === 'error' || data.status === 'missing') {
                    isDownloading = false;
                    isMissing = true;
                }
            });
        }
    }

    function handleSeek(e) {
        e.preventDefault();
        e.stopPropagation();

        if (!audioElement || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        audioElement.currentTime = newTime;
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    function handleRemove(e) {
        e.stopPropagation();
        if (onRemove) {
            onRemove();
        }
    }

    onDestroy(() => {
        cleanupSubscription();
    });
</script>

<div
    class="position-relative"
    style="width: {width ?? size + 'px'}; height: {size}px; max-width: 100%;"
>
    <!-- Remove Button -->
    {#if showRemoveButton}
        <button
            type="button"
            class="btn btn-sm btn-dark bg-opacity-75 text-white rounded-circle position-absolute d-flex align-items-center justify-content-center border-0 opacity-0-hover-100 transition-opacity"
            style="width: 22px; height: 22px; padding: 0; top: 5px; right: 5px; z-index: 10;"
            onclick={handleRemove}
            title="Remove audio"
            aria-label="Remove audio"
        >
            <i class="bi bi-x-lg" style="font-size: 10px;"></i>
        </button>
    {/if}

    <!-- Audio Preview (Square) -->
    <div
        class="bg-light rounded overflow-hidden d-flex flex-column align-items-center justify-content-center p-2 w-100 h-100"
    >
        {#if isDownloading}
            <div class="d-flex flex-column align-items-center justify-content-center gap-2 w-100 h-100 px-4 text-center">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <small class="text-secondary opacity-75 mt-1">Connecting to peers...</small>
            </div>
        {:else if isMissing}
            <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center h-100 px-3">
                <i class="bi bi-exclamation-circle fs-2"></i>
                <span class="small">Missing audio</span>
            </div>
        {:else}
            <i class="bi bi-music-note-beamed text-muted mb-2" style="font-size: 1.5rem;"></i>
            
            <div class="w-100">
                <div class="d-flex align-items-center justify-content-between mb-2">
                    <button
                        class="btn btn-sm btn-link p-0 d-flex align-items-center justify-content-center border-0"
                        onclick={togglePlay}
                        disabled={!isLoaded}
                        style="width: 20px; height: 20px;"
                        aria-label={isPlaying ? "Pause" : "Play"}
                    >
                        {#if isPlaying}
                            <i
                                class="bi bi-pause-circle text-dark"
                                style="font-size: 20px;"
                            ></i>
                        {:else}
                            <i
                                class="bi bi-play-circle text-dark"
                                style="font-size: 20px;"
                            ></i>
                        {/if}
                    </button>

                    <span
                        class="text-muted text-end"
                        style="font-size: 11px; min-width: 35px;"
                    >
                        {formatTime(duration)}
                    </span>
                </div>

                <div
                    class="bg-secondary bg-opacity-25 rounded-pill position-relative user-select-none"
                    style="height: 4px; cursor: pointer;"
                    onclick={handleSeek}
                    onkeydown={(e) => e.key === "Enter" && handleSeek(e)}
                    role="button"
                    tabindex="0"
                    aria-label="Seek audio position"
                >
                    <div
                        class="bg-secondary rounded-pill h-100 transition-all"
                        style="width: {duration
                            ? (currentTime / duration) * 100
                            : 0}%; transition: width 0.1s ease;"
                    ></div>
                    <div
                        class="bg-secondary rounded-circle position-absolute opacity-0 transition-opacity"
                        style="width: 12px; height: 12px; top: -4px; left: {duration
                            ? (currentTime / duration) * 100
                            : 0}%; transform: translateX(-50%);"
                    ></div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Hidden Audio Element -->
    <audio
        bind:this={audioElement}
        src={audioSource || ""}
        ontimeupdate={handleTimeUpdate}
        onloadedmetadata={handleLoadedMetadata}
        onplay={handlePlay}
        onpause={handlePause}
        onerror={handleError}
        preload="metadata"
    ></audio>
</div>

<style>
    /* Custom hover effects that complement Bootstrap */
    .bg-secondary.bg-opacity-25:hover .opacity-0 {
        opacity: 1 !important;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
