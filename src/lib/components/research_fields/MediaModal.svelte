<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { executeQuery } from "$lib/api/graphqlClient.js";
    import { parseMetadata } from "$lib/utils/assetMetadata.js";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import { IconTrash, IconDeviceFloppy } from "@tabler/icons-svelte";
    import MediaViewer from "$lib/components/research_fields/MediaViewer.svelte";

    let { asset = null, isOpen = false, onClose = null, onDelete = null, onUpdate = null } = $props();
    const { t } = getTranslationStore();

    let isSaving = $state(false);
    let isDeleting = $state(false);

    const CHAR_LIMIT = 150;
    const META_FIELDS = ["description", "copyright", "author"];

    // Local editable state
    let form = $state({ description: "", copyright: "", author: "" });

    function getMetaValue(metadata, field, defaultLang) {
        const val = metadata?.[field];
        if (typeof val === "string") return val;
        if (typeof val === "object" && val !== null) return val[defaultLang] ?? "";
        return "";
    }

    function syncForm() {
        if (!asset) return;
        const metadata = parseMetadata(asset.properties);
        const lang = asset.project?.default_language_code || "en";
        form = {
            description: getMetaValue(metadata, "description", lang),
            copyright: getMetaValue(metadata, "copyright", lang),
            author: getMetaValue(metadata, "author", lang),
        };
    }

    $effect(() => { if (asset) syncForm(); });

    const hasChanges = $derived.by(() => {
        if (!asset) return false;
        const metadata = parseMetadata(asset.properties);
        const lang = asset.project?.default_language_code || "en";
        return META_FIELDS.some((f) => form[f] !== getMetaValue(metadata, f, lang));
    });

    async function handleSave() {
        if (!asset?.id) return;
        isSaving = true;
        try {
            const existing = parseMetadata(asset.properties);
            const lang = asset.project?.default_language_code || "en";
            const updated = {
                ...existing,
                description: { ...(existing.description || {}), [lang]: form.description.trim() },
                copyright: { ...(existing.copyright || {}), [lang]: form.copyright.trim() },
                author: { ...(existing.author || {}), [lang]: form.author.trim() },
            };

            const result = await executeQuery('genericAssets', 'update', { assetId: asset.id, properties: JSON.stringify(updated) });
            if (result.error) throw new Error(result.error);

            onUpdate?.({ ...asset, properties: updated });
            addToast({ data: { type: "success", title: t("common.save", { fallback: "Save" }), description: t("common.changes-saved", { fallback: "Changes saved successfully." }) } });
        } catch (e) {
            console.error("Failed to update asset metadata:", e);
            addToast({ data: { type: "danger", title: t("common.error", { fallback: "Error" }), description: e.message || String(e) } });
        } finally {
            isSaving = false;
        }
    }

    async function handleDelete() {
        if (!asset?.id) return;
        if (!confirm(t("media.confirm-delete", { fallback: "Are you sure you want to delete this media? This action cannot be undone." }))) return;
        isDeleting = true;
        try {
            const result = await executeQuery('genericAssets', 'delete', { assetId: asset.id });
            if (result.error) throw new Error(result.error);
            addToast({ data: { type: "success", title: t("common.delete", { fallback: "Delete" }), description: t("common.deleted-successfully", { fallback: "Deleted successfully." }) } });
            onDelete?.(asset);
            onClose?.();
        } catch (e) {
            console.error("Failed to delete asset:", e);
            addToast({ data: { type: "danger", title: t("common.error", { fallback: "Error" }), description: e.message || String(e) } });
        } finally {
            isDeleting = false;
        }
    }

    function handleBackdrop(e) {
        if (e.target === e.currentTarget) onClose?.();
    }

    function handleKeydown(e) {
        if (e.key === "Escape") onClose?.();
    }

    $effect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            document.addEventListener("keydown", handleKeydown);
        } else {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeydown);
        }
    });
</script>

{#if isOpen && asset}
    <div class="modal-backdrop position-fixed top-0 start-0 w-100 h-100" style="z-index: 1050; background-color: rgba(0, 0, 0, 0.5);" onclick={handleBackdrop} role="presentation">
        <div class="modal-dialog position-absolute top-50 start-50 translate-middle" style="max-width: 1200px; max-height: 95vh; margin: 0; width: 95vw;" role="dialog" aria-modal="true" aria-labelledby="media-modal-title">
            <div class="modal-content bg-white rounded shadow-lg d-flex flex-column" style="max-height: 95vh;">
                <!-- Header -->
                <div class="modal-header d-flex align-items-center justify-content-between py-3 px-4 border-bottom">
                    <h5 id="media-modal-title" class="modal-title mb-0 fw-semibold">{asset.filename || asset.name || t("media.unknown-file", { fallback: "Unknown file" })}</h5>
                    <button type="button" class="btn-close" onclick={() => onClose?.()} aria-label={t("media.close-media-preview", { fallback: "Close media preview" })}></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-4 overflow-auto">
                    <div class="row g-4">
                        <div class="col-md-8">
                            <MediaViewer {asset} />
                        </div>

                        <div class="col-md-4">
                            <!-- Info -->
                            <div class="mb-4">
                                <p class="text-uppercase fs-7 text-body-tertiary mb-2">{t("common.info", { fallback: "Info" })}</p>
                                <div class="small text-body-secondary">
                                    <div>{t("media.import-date", { fallback: "Import date" })}: {asset.created_at ? new Date(asset.created_at).toISOString().slice(0, 10) : "—"}</div>
                                    <div>{t("media.size", { fallback: "Size" })}: {asset.torrent_length ? (asset.torrent_length / 1024 / 1024).toFixed(1) + " MB" : "—"}</div>
                                </div>
                            </div>

                            <!-- Metadata Form -->
                            <div>
                                <p class="text-uppercase fs-7 text-body-tertiary mb-3">{t("media.media-metadata", { fallback: "Media metadata" })}</p>
                                {#each META_FIELDS as field}
                                    <div class="mb-3">
                                        <label class="form-label d-flex justify-content-between align-items-center mb-1">
                                            <span>{t(`common.${field}`, { fallback: field.charAt(0).toUpperCase() + field.slice(1) })}</span>
                                            <span class="text-muted" style="font-size: 0.75rem;">{form[field].length}/{CHAR_LIMIT}</span>
                                        </label>
                                        <textarea class="form-control" rows="2" maxlength={CHAR_LIMIT} bind:value={form[field]} placeholder={t("common.write-here", { fallback: "Write here..." })}></textarea>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="modal-footer d-flex align-items-center justify-content-between py-3 px-4 border-top">
                    <button type="button" class="btn btn-outline-danger btn-sm d-flex align-items-center gap-2" onclick={handleDelete} disabled={isDeleting}>
                        <IconTrash size={14} />
                        {isDeleting ? t("common.deleting", { fallback: "Deleting..." }) : t("media.delete-media", { fallback: "Delete media" })}
                    </button>
                    <button type="button" class="btn btn-success btn-sm d-flex align-items-center gap-2" onclick={handleSave} disabled={!hasChanges || isSaving}>
                        <IconDeviceFloppy size={14} />
                        {isSaving ? t("common.saving", { fallback: "Saving..." }) : t("common.save-changes", { fallback: "Save changes" })}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop { backdrop-filter: blur(2px); }
    .modal-content { animation: modalFadeIn 0.2s ease-out; }
    @keyframes modalFadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
</style>
