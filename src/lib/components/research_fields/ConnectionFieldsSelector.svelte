<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";

    let { config = $bindable(), disabled = false } = $props();
    const { t } = getTranslationStore();

    if (!config) {
        config = { ...DEFAULT_FIELDS_CONFIG };
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
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-thumbnail" bind:checked={config.thumbnail} {disabled} />
                    <label class="form-check-label flex-grow-1" for="field-thumbnail">{t("connections.main-image", { fallback: "Thumbnail" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-url" bind:checked={config.url} {disabled} />
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
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-images" bind:checked={config.images} {disabled} />
                    <label class="form-check-label flex-grow-1" for="field-images">{t("common.images", { fallback: "Images" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-videos" bind:checked={config.videos} {disabled} />
                    <label class="form-check-label flex-grow-1" for="field-videos">{t("common.videos", { fallback: "Videos" })}</label>
                </div>
            </div>
            <div class="p-2 border-top">
                <div class="form-check ps-0 m-0 d-flex align-items-center">
                    <input class="form-check-input m-0 me-2" type="checkbox" id="field-audios" bind:checked={config.audios} {disabled} />
                    <label class="form-check-label flex-grow-1" for="field-audios">{t("connections.field.audio", { fallback: "Audio" })}</label>
                </div>
            </div>
        </div>
    </div>
</div>
