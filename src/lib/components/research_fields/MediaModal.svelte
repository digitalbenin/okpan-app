<script>
    import { onDestroy } from 'svelte';
    import { getMediaType, parseAssetFormats, addImageProtocolPrefix } from '$lib/utils/media.js';
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    
    let { asset = null, isOpen = false, onClose = null } = $props();
    const { t } = getTranslationStore();

    let videoElement = $state(null);
    let viewerEl = $state(null);
    let osdViewer = $state(null);
    let OpenSeadragonLib = null;

    const zoomStep = 0.25; // 25% per click

    // Dynamic import of OpenSeadragon (only when needed)
    function ensureOsd() {
        if (OpenSeadragonLib) return Promise.resolve(OpenSeadragonLib);
        return import('openseadragon').then((mod) => {
            OpenSeadragonLib = mod.default || mod;
            return OpenSeadragonLib;
        });
    }

    function createOrOpenViewer(existing, el, url) {
        if (!el || !url || !OpenSeadragonLib) return existing;
        if (!existing) {
            existing = OpenSeadragonLib({
                element: el,
                showNavigationControl: false,
                preserveImageSizeOnResize: true,
                visibilityRatio: 1.0,
                constrainDuringPan: false,
                zoomPerScroll: 1.2,
                gestureSettingsMouse: {
                    scrollToZoom: true,
                    clickToZoom: false,
                    dblClickToZoom: true,
                    dragToPan: true
                },
                gestureSettingsTouch: {
                    pinchToZoom: true,
                    dblClickToZoom: false,
                    dragToPan: true
                }
            });
        }
        existing.open({ type: 'image', url });
        return existing;
    }

    function openViewer() {
        if (!asset || !viewerEl) return;
        ensureOsd().then(() => {
            const imagePath = getImagePath(asset);
            if (imagePath) {
                osdViewer = createOrOpenViewer(osdViewer, viewerEl, imagePath);
            }
        });
    }

    function getImagePath(asset) {
        if (!asset) return null;
        const formats = parseAssetFormats(asset.formats);
        // Use original format for best quality in viewer
        const path = formats?.original || asset.path;
        return path ? addImageProtocolPrefix(path) : null;
    }

    function zoomIn() {
        if (osdViewer) {
            osdViewer.viewport.zoomBy(1 + zoomStep);
            osdViewer.viewport.applyConstraints();
        }
    }

    function zoomOut() {
        if (osdViewer) {
            osdViewer.viewport.zoomBy(1 / (1 + zoomStep));
            osdViewer.viewport.applyConstraints();
        }
    }

    function toggleFullscreen() {
        if (!viewerEl) return;
        
        if (!document.fullscreenElement) {
            viewerEl.requestFullscreen?.() || 
            viewerEl.webkitRequestFullscreen?.() || 
            viewerEl.msRequestFullscreen?.();
        } else {
            document.exitFullscreen?.() || 
            document.webkitExitFullscreen?.() || 
            document.msExitFullscreen?.();
        }
    }

    function handleClose() {
        // Pause video if it's playing
        if (videoElement) {
            videoElement.pause();
        }

        // Destroy OpenSeadragon viewer
        if (osdViewer) {
            osdViewer.destroy();
            osdViewer = null;
        }

        if (onClose) {
            onClose();
        }
    }

    function handleBackdropClick(e) {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    }

    function handleKeydown(e) {
        if (e.key === "Escape") {
            handleClose();
        }
    }

    const mediaType = $derived(getMediaType(asset));
    const isImage = $derived(mediaType === "image");
    const isVideo = $derived(mediaType === "video");

    $effect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            document.addEventListener("keydown", handleKeydown);
            
            // Open viewer for images
            if (isImage) {
                requestAnimationFrame(() => openViewer());
            }
        } else {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeydown);
        }

        return () => {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeydown);
        };
    });

    onDestroy(() => {
        if (osdViewer) {
            osdViewer.destroy();
            osdViewer = null;
        }
    });
</script>

{#if isOpen && asset}
    <div
        class="modal-backdrop position-fixed top-0 start-0 w-100 h-100"
        style="z-index: 1050; background-color: rgba(0, 0, 0, 0.5);"
        onclick={handleBackdropClick}
        onkeydown={(e) => e.key === 'Enter' && handleBackdropClick(e)}
        role="presentation"
    >
        <div
            class="modal-dialog position-absolute top-50 start-50 translate-middle"
            style="max-width: 1200px; max-height: 95vh; margin: 0; width: 95vw;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="media-modal-title"
        >
            <div class="modal-content bg-white rounded shadow-lg">
                <!-- Close Button (pink, top-right outside the content) -->
                <button
                    type="button"
                    class="btn position-absolute rounded-circle d-flex align-items-center justify-content-center"
                    style="top: -15px; right: -15px; z-index: 1051; width: 40px; height: 40px; background-color: #e91e63; border: none;"
                    onclick={handleClose}
                    aria-label={t("media.close-media-preview", { fallback: "Close media preview" })}
                >
                    <i class="bi bi-x text-white" style="font-size: 24px; font-weight: bold;" aria-hidden="true"></i>
                </button>

                <div class="modal-body p-4">
                     <p id="media-modal-title" class="mb-3 fw-bold">
                                {t("media.view-file", {
                                    fallback: "View {{file}}",
                                    file: asset.filename || asset.name || t("media.unknown-file", { fallback: "Unknown file" }),
                                })}
                            </p>
                    <div class="row g-4">
                        <!-- Left column: Image viewer -->
                        <div class="col-md-9">
                            <!-- Title -->
                           

                            <!-- Image viewer with controls -->
                            <div class="position-relative bg-light rounded overflow-hidden" style="height: 70vh;">
                                {#if isImage}
                                    <!-- Controls overlay -->
                                    <div class="position-absolute top-0 start-0 m-2 d-flex gap-2" style="z-index: 10;">
                                        <button
                                            class="btn btn-light btn-sm"
                                            title={t("media.zoom-in", { fallback: "Zoom in" })}
                                            onclick={zoomIn}
                                            aria-label={t("media.zoom-in", { fallback: "Zoom in" })}
                                        >
                                            <i class="bi bi-zoom-in" aria-hidden="true"></i>
                                        </button>
                                        <button
                                            class="btn btn-light btn-sm"
                                            title={t("media.zoom-out", { fallback: "Zoom out" })}
                                            onclick={zoomOut}
                                            aria-label={t("media.zoom-out", { fallback: "Zoom out" })}
                                        >
                                            <i class="bi bi-zoom-out" aria-hidden="true"></i>
                                        </button>
                                        <button
                                            class="btn btn-light btn-sm"
                                            title={t("media.fullscreen", { fallback: "Fullscreen" })}
                                            onclick={toggleFullscreen}
                                            aria-label={t("media.toggle-fullscreen", { fallback: "Toggle fullscreen" })}
                                        >
                                            <i class="bi bi-arrows-fullscreen" aria-hidden="true"></i>
                                        </button>
                                    </div>

                                    <!-- OpenSeadragon container -->
                                    <div bind:this={viewerEl} class="w-100 h-100"></div>
                                {:else if isVideo}
                                    <video
                                        bind:this={videoElement}
                                        src="media://{asset.path}"
                                        controls
                                        class="w-100 h-100"
                                        style="object-fit: contain;"
                                        preload="metadata"
                                        aria-label={asset.filename || asset.name || t("media.video-preview", { fallback: "Video preview" })}
                                    >
                                        <track kind="captions" />
                                        {t("media.browser-no-video", { fallback: "Your browser does not support the video tag." })}
                                    </video>
                                {:else}
                                    <div class="w-100 h-100 d-flex align-items-center justify-content-center">
                                        <div class="text-center text-muted">
                                            <i class="bi bi-file-earmark" style="font-size: 48px;" aria-hidden="true"></i>
                                            <p class="mt-2">{t("media.preview-not-available", { fallback: "Preview not available for this file type" })}</p>
                                        </div>
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <!-- Right column: Metadata -->
                        <div class="col-md-3">
                            <h5 class="text-muted mb-3 border-bottom">{t("media.media-metadata", { fallback: "Media metadata" })}</h5>

                            {#if asset.description || asset.author || asset.copyright}
                                <!-- Description -->
                                {#if asset.description}
                                    <div class="mb-3">
                                        <div class="text-uppercase small fw-bold mb-1">Description</div>
                                        <div class="text-muted small">{asset.description}</div>
                                    </div>
                                {/if}

                                <!-- Author/Copyright -->
                                {#if asset.author}
                                    <div class="mb-3">
                                        <div class="text-uppercase small fw-bold mb-1">{t("media.author", { fallback: "Author" })}</div>
                                        <div class="text-muted small">{asset.author}</div>
                                    </div>
                                {/if}

                                {#if asset.copyright}
                                    <div class="mb-3">
                                        <div class="text-uppercase small fw-bold mb-1">{t("common.copyright", { fallback: "Copyright" })}</div>
                                        <div class="text-muted small">{asset.copyright}</div>
                                    </div>
                                {/if}
                            {:else}
                                <div class="text-muted small">{t("media.no-metadata-available", { fallback: "No metadata available" })}</div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        backdrop-filter: blur(2px);
    }

    .modal-content {
        animation: modalFadeIn 0.2s ease-out;
    }

    @keyframes modalFadeIn {
        from {
            opacity: 0;
            transform: scale(0.95);
        }
        to {
            opacity: 1;
            transform: scale(1);
        }
    }

    .btn:focus {
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }
</style>
