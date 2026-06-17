<script>
    import { page } from '$app/state';
    import { onDestroy } from 'svelte';
    import { addImageProtocolPrefix } from '$lib/utils/media.js';
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { IconX, IconExclamationCircle, IconPlayerPlayFilled } from "@tabler/icons-svelte";

    let {
        asset,
        size = 200,
        width = undefined,
        showRemoveButton = false,
        onRemove = null,
        onClick = null,
    } = $props();

    let audioElement;
    const { t } = getTranslationStore();
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

    function handleLoadedMetadata() { isLoaded = true; isMissing = false; }

    function handleError() {
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
                        setTimeout(() => { if (audioElement) audioElement.load(); }, 100);
                    }
                } else if (data.status === 'error' || data.status === 'missing') {
                    isDownloading = false;
                    isMissing = true;
                }
            });
        }
    }

    function handleClick() {
        if (onClick) onClick(asset);
    }

    function handleRemove(e) {
        e.stopPropagation();
        if (onRemove) onRemove(asset);
    }

    onDestroy(() => {
        cleanupSubscription();
    });
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
            title={t("media.remove-audio", { fallback: "Remove audio" })}
            aria-label={t("media.remove-audio", { fallback: "Remove audio" })}
        >
            <IconX size={14} />
        </button>
    {/if}

    <!-- Audio Preview -->
    <div
        class="d-flex align-items-center justify-content-center position-relative w-100 flex-grow-1"
        style="background-color: #E9EEF1; cursor: pointer; min-height: 0;"
        role="button"
        tabindex="0"
        onclick={handleClick}
        onkeydown={(e) => e.key === "Enter" && handleClick()}
    >
        {#if isDownloading}
            <div class="d-flex flex-column align-items-center justify-content-center gap-2 px-4 text-center">
                <div class="spinner-border text-secondary" role="status">
                    <span class="visually-hidden">{t("common.loading", { fallback: "Loading..." })}</span>
                </div>
                <small class="text-secondary opacity-75 mt-1">{t("media.connecting-to-peers", { fallback: "Connecting to peers..." })}</small>
            </div>
        {:else if isMissing}
            <div class="d-flex flex-column align-items-center justify-content-center gap-2 opacity-50 text-center px-3">
                <IconExclamationCircle size={24} />
                <span class="small">{t("media.missing-audio", { fallback: "Missing audio" })}</span>
            </div>
           
        {/if}

        <!-- Play Button Overlay -->
        <div
            class="position-absolute d-flex align-items-center justify-content-center hover-opacity-100"
            style="top: 0; left: 0; right: 0; bottom: 0;"
        >
            <div
                class="bg-white rounded-circle d-flex align-items-center justify-content-center transition-transform"
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

    <!-- Hidden Audio Element -->
    <audio
        bind:this={audioElement}
        src={audioSource || ""}
        onloadedmetadata={handleLoadedMetadata}
        onerror={handleError}
        preload="metadata"
    ></audio>
</div>

<style>
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
