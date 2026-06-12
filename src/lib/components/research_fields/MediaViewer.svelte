<script>
    import { onDestroy } from 'svelte';
    import { getMediaType, parseAssetFormats, addImageProtocolPrefix } from '$lib/utils/media.js';
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    let { asset = null } = $props();
    const { t } = getTranslationStore();

    let videoElement = $state(null);
    let audioElement = $state(null);
    let viewerEl = $state(null);
    let osdViewer = $state(null);
    let OpenSeadragonLib = null;

    let isPlaying = $state(false);
    let currentTime = $state(0);
    let duration = $state(0);

    const mediaType = $derived(getMediaType(asset));
    const isImage = $derived(mediaType === "image");
    const isVideo = $derived(mediaType === "video");
    const isAudio = $derived(mediaType === "audio");

    function ensureOsd() {
        if (OpenSeadragonLib) return Promise.resolve(OpenSeadragonLib);
        return import('openseadragon').then((mod) => {
            OpenSeadragonLib = mod.default || mod;
            return OpenSeadragonLib;
        });
    }

    function createViewer(el, url) {
        if (!el || !url || !OpenSeadragonLib) return null;
        const viewer = OpenSeadragonLib({
            element: el,
            showNavigationControl: false,
            preserveImageSizeOnResize: true,
            visibilityRatio: 1.0,
            constrainDuringPan: false,
            zoomPerScroll: 1.2,
            gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true, dragToPan: true },
            gestureSettingsTouch: { pinchToZoom: true, dblClickToZoom: false, dragToPan: true }
        });
        viewer.open({ type: 'image', url });
        return viewer;
    }

    function getImagePath(asset) {
        if (!asset) return null;
        const formats = parseAssetFormats(asset.formats);
        const path = formats?.original || asset.path;
        return path ? addImageProtocolPrefix(path) : null;
    }

    function zoom(factor) {
        if (osdViewer) {
            osdViewer.viewport.zoomBy(factor);
            osdViewer.viewport.applyConstraints();
        }
    }

    function toggleFullscreen() {
        if (!viewerEl) return;
        if (!document.fullscreenElement) {
            viewerEl.requestFullscreen?.() || viewerEl.webkitRequestFullscreen?.() || viewerEl.msRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() || document.webkitExitFullscreen?.() || document.msExitFullscreen?.();
        }
    }

    function openViewer() {
        if (!asset || !viewerEl) return;
        ensureOsd().then(() => {
            const path = getImagePath(asset);
            if (path) osdViewer = createViewer(viewerEl, path);
        });
    }

    function toggleAudioPlay() {
        if (!audioElement) return;
        if (isPlaying) audioElement.pause();
        else audioElement.play().catch((e) => console.error("Audio play error:", e));
    }

    function handleAudioSeek(e) {
        if (!audioElement || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        audioElement.currentTime = percentage * duration;
    }

    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    $effect(() => {
        if (asset && isImage) {
            requestAnimationFrame(() => openViewer());
        }
    });

    onDestroy(() => {
        if (osdViewer) { osdViewer.destroy(); osdViewer = null; }
    });
</script>

<div class="position-relative bg-dark rounded overflow-hidden" style="height: 60vh;">
    {#if isImage}
        <div class="position-absolute top-0 start-0 m-2 d-flex gap-2" style="z-index: 10;">
            <button class="btn btn-light btn-sm" title={t("media.zoom-in", { fallback: "Zoom in" })} onclick={() => zoom(1.25)} aria-label={t("media.zoom-in", { fallback: "Zoom in" })}>
                <i class="bi bi-zoom-in" aria-hidden="true"></i>
            </button>
            <button class="btn btn-light btn-sm" title={t("media.zoom-out", { fallback: "Zoom out" })} onclick={() => zoom(0.8)} aria-label={t("media.zoom-out", { fallback: "Zoom out" })}>
                <i class="bi bi-zoom-out" aria-hidden="true"></i>
            </button>
            <button class="btn btn-light btn-sm" title={t("media.fullscreen", { fallback: "Fullscreen" })} onclick={toggleFullscreen} aria-label={t("media.toggle-fullscreen", { fallback: "Toggle fullscreen" })}>
                <i class="bi bi-arrows-fullscreen" aria-hidden="true"></i>
            </button>
        </div>
        <div bind:this={viewerEl} class="w-100 h-100"></div>
    {:else if isVideo}
        <video bind:this={videoElement} src="media://{asset.path}" controls class="w-100 h-100" style="object-fit: contain;" preload="metadata"
            aria-label={asset.filename || asset.name || t("media.video-preview", { fallback: "Video preview" })}>
            <track kind="captions" />
            {t("media.browser-no-video", { fallback: "Your browser does not support the video tag." })}
        </video>
    {:else if isAudio}
        <div class="w-100 h-100 d-flex flex-column align-items-center justify-content-center text-white px-5">
            <i class="bi bi-music-note-beamed mb-4" style="font-size: 3rem;"></i>
            <div class="w-100" style="max-width: 400px;">
                <div class="d-flex align-items-center justify-content-between mb-3">
                    <button class="btn btn-link text-white p-0 d-flex align-items-center justify-content-center border-0" onclick={toggleAudioPlay} style="width: 32px; height: 32px;"
                        aria-label={isPlaying ? t("media.pause", { fallback: "Pause" }) : t("media.play", { fallback: "Play" })}>
                        <i class="bi {isPlaying ? 'bi-pause-circle' : 'bi-play-circle'}" style="font-size: 28px;"></i>
                    </button>
                    <span class="text-white-50" style="font-size: 13px;">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                </div>
                <div class="bg-white bg-opacity-25 rounded-pill position-relative" style="height: 5px; cursor: pointer;" onclick={handleAudioSeek} role="button" tabindex="0"
                    aria-label={t("media.seek-audio-position", { fallback: "Seek audio position" })}>
                    <div class="bg-white rounded-pill h-100" style="width: {duration ? (currentTime / duration) * 100 : 0}%;"></div>
                    <div class="bg-white rounded-circle position-absolute" style="width: 14px; height: 14px; top: -4.5px; left: {duration ? (currentTime / duration) * 100 : 0}%; transform: translateX(-50%);"></div>
                </div>
            </div>
            <audio bind:this={audioElement} src="media://{asset.path}" class="d-none"
                ontimeupdate={() => { if (audioElement) currentTime = audioElement.currentTime; }}
                onloadedmetadata={() => { if (audioElement) duration = audioElement.duration; }}
                onplay={() => isPlaying = true}
                onpause={() => isPlaying = false}
                preload="metadata"></audio>
        </div>
    {:else}
        <div class="w-100 h-100 d-flex align-items-center justify-content-center">
            <div class="text-center text-muted">
                <i class="bi bi-file-earmark" style="font-size: 48px;" aria-hidden="true"></i>
                <p class="mt-2">{t("media.preview-not-available", { fallback: "Preview not available for this file type" })}</p>
            </div>
        </div>
    {/if}
</div>
