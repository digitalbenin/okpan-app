<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";

    let { config = $bindable(), disabled = false } = $props();
    const { t } = getTranslationStore();

    // Default keys order
    const keys = ["description", "url", "thumbnail", "images", "videos", "audios"];

    function getLabel(key) {
        switch (key) {
            case "description": return t("common.description", { fallback: "Description" });
            case "url": return t("common.url", { fallback: "URL" });
            case "thumbnail": return t("connections.main-image", { fallback: "Main image" });
            case "images": return t("common.images", { fallback: "Images" });
            case "videos": return t("common.videos", { fallback: "Videos" });
            case "audios": return t("common.audios", { fallback: "Audios" });
            default: return key;
        }
    }

    // Initialize config if missing
    if (!config) {
        config = { ...DEFAULT_FIELDS_CONFIG };
    }
</script>

<div class="d-flex flex-column gap-3">
    {#each keys as key}
        <div class="form-check p-3 border rounded bg-light d-flex align-items-center">
            <input
                class="form-check-input m-0 me-3 fs-5"
                type="checkbox"
                id={`field-${key}`}
                bind:checked={config[key]}
                {disabled}
            />
            <label class="form-check-label flex-grow-1" for={`field-${key}`} style="cursor: pointer">
                {getLabel(key)}
            </label>
        </div>
    {/each}
</div>
