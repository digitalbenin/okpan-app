<script>
    import { onDestroy } from 'svelte';
    import { watch } from "runed";
    import { getMediaType, parseAssetFormats, addImageProtocolPrefix } from '$lib/utils/media.js';
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { executeQuery } from "$lib/api/graphqlClient.js";
    import { parseMetadata } from "$lib/utils/assetMetadata.js";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import { IconTrash, IconDeviceFloppy } from "@tabler/icons-svelte";

    let { asset = null, isOpen = false, onClose = null, onDelete = null, onUpdate = null } = $props();
    const { t } = getTranslationStore();

    let videoElement = $state(null);
    let viewerEl = $state(null);
    let osdViewer = $state(null);
    let OpenSeadragonLib = null;
    let isSaving = $state(false);
    let isDeleting = $state(false);

    // Editable metadata fields
    let description = $state("");
    let copyright = $state("");
    let author = $state("");

    const CHAR_LIMIT = 150;

    // Sync local state when asset changes (metadata is stored in properties JSON)
    watch(() => asset, (a) => {
        if (a) {
            const metadata = parseMetadata(a.properties);
            const defaultLang = a.project?.default_language_code || "en";

            // Helper: metadata values can be strings (legacy) or objects { en: "..." }
            const getMetaValue = (field) => {
                const val = metadata?.[field];
                if (typeof val === "string") return val;
                if (typeof val === "object" && val !== null) {
                    return val[defaultLang] ?? "";
                }
                return "";
            };

            description = getMetaValue("description");
            copyright = getMetaValue("copyright");
            author = getMetaValue("author");
        }
    });

    const zoomStep = 0.25;

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

    async function handleSave() {
        if (!asset?.id) return;
        isSaving = true;
        try {
            // Parse existing properties and merge new metadata
            const existingProps = parseMetadata(asset.properties);
            const defaultLang = asset.project?.default_language_code || "en";
            const updatedProperties = {
                ...existingProps,
                description: { ...(existingProps.description || {}), [defaultLang]: description.trim() },
                copyright: { ...(existingProps.copyright || {}), [defaultLang]: copyright.trim() },
                author: { ...(existingProps.author || {}), [defaultLang]: author.trim() },
            };

            const payload = { assetId: asset.id, properties: JSON.stringify(updatedProperties) };
            console.log("[MediaModal] save payload:", payload);

            // Generic assets are stored in the generic_assets table, not assets table
            const result = await executeQuery('genericAssets', 'update', payload);
            console.log("[MediaModal] save result:", result);
            if (result.error) {
                throw new Error(result.error);
            }
            // Notify parent of updated asset
            if (onUpdate) {
                onUpdate({ ...asset, properties: updatedProperties });
            }
            addToast({
                data: { type: "success", title: t("common.save", { fallback: "Save" }), description: t("common.changes-saved", { fallback: "Changes saved successfully." }) }
            });
        } catch (e) {
            console.error("Failed to update asset metadata:", e);
            addToast({
                data: { type: "danger", title: t("common.error", { fallback: "Error" }), description: e.message || String(e) }
            });
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!asset?.id) return;
        if (!confirm(t("media.confirm-delete", { fallback: "Are you sure you want to delete this media? This action cannot be undone." }))) {
            return;
        }
        isDeleting = true;
        try {
            // Generic assets use the genericAssets delete operation
            const result = await executeQuery('genericAssets', 'delete', { assetId: asset.id });
            if (result.error) {
                throw new Error(result.error);
            }
            addToast({
                data: { type: "success", title: t("common.delete", { fallback: "Delete" }), description: t("common.deleted-successfully", { fallback: "Deleted successfully." }) }
            });
            if (onDelete) onDelete(asset);
            handleClose();
        } catch (e) {
            console.error("Failed to delete asset:", e);
            addToast({
                data: { type: "danger", title: t("common.error", { fallback: "Error" }), description: e.message || String(e) }
            });
        } finally {
            isDeleting = false;
        }
    }

    function handleClose() {
        if (videoElement) {
            videoElement.pause();
        }
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

    const hasChanges = $derived.by(() => {
        const metadata = parseMetadata(asset?.properties);
        const defaultLang = asset?.project?.default_language_code || "en";
        const getMetaValue = (field) => {
            const val = metadata?.[field];
            if (typeof val === "string") return val;
            if (typeof val === "object" && val !== null) {
                return val[defaultLang] ?? "";
            }
            return "";
        };
        return (
            description !== getMetaValue("description") ||
            copyright !== getMetaValue("copyright") ||
            author !== getMetaValue("author")
        );
    });

    watch(() => isOpen, (open) => {
        if (open) {
            document.body.style.overflow = "hidden";
            document.addEventListener("keydown", handleKeydown);
            if (isImage) {
                requestAnimationFrame(() => openViewer());
            }
        } else {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeydown);
        }
    });

    onDestroy(() => {
        document.body.style.overflow = "";
        document.removeEventListener("keydown", handleKeydown);
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
            <div class="modal-content bg-white rounded shadow-lg d-flex flex-column" style="max-height: 95vh;">
                <!-- Header -->
                <div class="modal-header d-flex align-items-center justify-content-between py-3 px-4 border-bottom">
                    <h5 id="media-modal-title" class="modal-title mb-0 fw-semibold">
                        {asset.filename || asset.name || t("media.unknown-file", { fallback: "Unknown file" })}
                    </h5>
                    <button
                        type="button"
                        class="btn-close"
                        onclick={handleClose}
                        aria-label={t("media.close-media-preview", { fallback: "Close media preview" })}
                    ></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-4 overflow-auto">
                    <div class="row g-4">
                        <!-- Left column: Image viewer -->
                        <div class="col-md-8">
                            <div class="position-relative bg-dark rounded overflow-hidden" style="height: 60vh;">
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

                        <!-- Right column: Info + Metadata form -->
                        <div class="col-md-4">
                            <!-- Info section -->
                            <div class="mb-4">
                                <p class="text-uppercase fs-7 text-body-tertiary mb-2">{t("common.info", { fallback: "Info" })}</p>
                                <div class="small text-body-secondary">
                                    <div>{t("media.import-date", { fallback: "Import date" })}: {asset.created_at ? new Date(asset.created_at).toISOString().slice(0, 10) : "—"}</div>
                                    <div>{t("media.size", { fallback: "Size" })}: {asset.torrent_length ? (asset.torrent_length / 1024 / 1024).toFixed(1) + " MB" : "—"}</div>
                                </div>
                            </div>

                            <!-- Media Metadata form -->
                            <div>
                                <p class="text-uppercase fs-7 text-body-tertiary mb-3">{t("media.media-metadata", { fallback: "Media metadata" })}</p>

                                <!-- Description -->
                                <div class="mb-3">
                                    <label class="form-label d-flex justify-content-between align-items-center mb-1">
                                        <span>{t("common.description", { fallback: "Description" })}</span>
                                        <span class="text-muted" style="font-size: 0.75rem;">{description.length}/{CHAR_LIMIT}</span>
                                    </label>
                                    <textarea
                                        class="form-control"
                                        rows="2"
                                        maxlength={CHAR_LIMIT}
                                        bind:value={description}
                                        placeholder={t("common.write-here", { fallback: "Write here..." })}
                                    ></textarea>
                                </div>

                                <!-- Copyright -->
                                <div class="mb-3">
                                    <label class="form-label d-flex justify-content-between align-items-center mb-1">
                                        <span>{t("common.copyright", { fallback: "Copyright" })}</span>
                                        <span class="text-muted" style="font-size: 0.75rem;">{copyright.length}/{CHAR_LIMIT}</span>
                                    </label>
                                    <textarea
                                        class="form-control"
                                        rows="2"
                                        maxlength={CHAR_LIMIT}
                                        bind:value={copyright}
                                        placeholder={t("common.write-here", { fallback: "Write here..." })}
                                    ></textarea>
                                </div>

                                <!-- Author -->
                                <div class="mb-3">
                                    <label class="form-label d-flex justify-content-between align-items-center mb-1">
                                        <span>{t("media.author", { fallback: "Author" })}</span>
                                        <span class="text-muted" style="font-size: 0.75rem;">{author.length}/{CHAR_LIMIT}</span>
                                    </label>
                                    <textarea
                                        class="form-control"
                                        rows="2"
                                        maxlength={CHAR_LIMIT}
                                        bind:value={author}
                                        placeholder={t("common.write-here", { fallback: "Write here..." })}
                                    ></textarea>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="modal-footer d-flex align-items-center justify-content-between py-3 px-4 border-top">
                    <button
                        type="button"
                        class="btn btn-outline-danger btn-sm d-flex align-items-center gap-2"
                        onclick={handleDelete}
                        disabled={isDeleting}
                    >
                        <IconTrash size={14} />
                        {isDeleting ? t("common.deleting", { fallback: "Deleting..." }) : t("media.delete-media", { fallback: "Delete media" })}
                    </button>
                    <button
                        type="button"
                        class="btn btn-success btn-sm d-flex align-items-center gap-2"
                        onclick={handleSave}
                        disabled={!hasChanges || isSaving}
                    >
                        <IconDeviceFloppy size={14} />
                        {isSaving ? t("common.saving", { fallback: "Saving..." }) : t("common.save-changes", { fallback: "Save changes" })}
                    </button>
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
