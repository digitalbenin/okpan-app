<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";

    let { config = $bindable(), value = $bindable(null), disabled = false, onChange = null } = $props();
    const { t } = getTranslationStore();

    const effectiveConfig = $derived(config || value || { ...DEFAULT_FIELDS_CONFIG });

    if (!config && !value) {
        config = { ...DEFAULT_FIELDS_CONFIG };
    }

    function emit(key, checked) {
        const updated = { ...effectiveConfig, [key]: checked };
        if (onChange) onChange(updated);
    }
</script>

<div class="d-flex flex-column gap-4">
    <div class="d-flex flex-column gap-1">
        <p class="fs-8 text-uppercase mb-0" style="letter-spacing: 0.02em;">{t("connections.section.main-info", { fallback: "Main info" })}</p>
        <div class="border rounded-3 overflow-hidden">
            <div class="p-2">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" checked disabled />
                    <label class="form-check-label">{t("connections.field.label-title", { fallback: "Label/Title" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" checked disabled />
                    <label class="form-check-label">{t("common.description", { fallback: "Description" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-thumbnail" checked={effectiveConfig.thumbnail} {disabled} onchange={(e) => { if (onChange) emit('thumbnail', e.target.checked); else config.thumbnail = e.target.checked; }} />
                    <label class="form-check-label flex-grow-1" for="field-thumbnail">{t("connections.main-image", { fallback: "Thumbnail" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-url" checked={effectiveConfig.url} {disabled} onchange={(e) => { if (onChange) emit('url', e.target.checked); else config.url = e.target.checked; }} />
                    <label class="form-check-label flex-grow-1" for="field-url">{t("connections.field.external-link", { fallback: "External link" })}</label>
                </div>
            </div>
        </div>
    </div>

    <div class="d-flex flex-column gap-1">
        <p class="fs-8 text-uppercase mb-0" style="letter-spacing: 0.02em;">{t("connections.section.media", { fallback: "Media" })}</p>
        <div class="border rounded-3 overflow-hidden">
            <div class="p-2">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-images" checked={effectiveConfig.images} {disabled} onchange={(e) => { if (onChange) emit('images', e.target.checked); else config.images = e.target.checked; }} />
                    <label class="form-check-label flex-grow-1" for="field-images">{t("common.images", { fallback: "Images" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-videos" checked={effectiveConfig.videos} {disabled} onchange={(e) => { if (onChange) emit('videos', e.target.checked); else config.videos = e.target.checked; }} />
                    <label class="form-check-label flex-grow-1" for="field-videos">{t("common.videos", { fallback: "Videos" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-audios" checked={effectiveConfig.audios} {disabled} onchange={(e) => { if (onChange) emit('audios', e.target.checked); else config.audios = e.target.checked; }} />
                    <label class="form-check-label flex-grow-1" for="field-audios">{t("connections.field.audio", { fallback: "Audio" })}</label>
                </div>
            </div>
        </div>
    </div>
</div>
