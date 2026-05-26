<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    let {
        textSelectedFieldId = $bindable(""),
        textQuery = $bindable(""),
        selectableTextFields = [],
        onFieldChange,
        onQueryInput,
        onBack,
    } = $props();

    const { t } = getTranslationStore();
</script>

<div class="p-3 d-flex flex-column gap-3 overflow-auto">
    <div class="d-flex align-items-center justify-content-between">
        <button class="btn btn-link text-decoration-none" onclick={onBack}>
            <i class="bi bi-arrow-left"></i>
            {t("nav.back", { fallback: "Back" })}
        </button>
    </div>

    <div class="mb-2">{t("filters.select-a-field", { fallback: "Select a field" })}</div>
    <select
        class="form-select"
        bind:value={textSelectedFieldId}
        onchange={onFieldChange}
    >
        <option value="">{t("filters.choose", { fallback: "Choose..." })}</option>
        {#each selectableTextFields as f (f.key)}
            <option value={f.key}>{f.label}</option>
        {/each}
    </select>

    <div class="mb-2">{t("filters.enter-query", { fallback: "Enter query" })}</div>
    <input
        type="text"
        class="form-control"
        placeholder={t("filters.type-to-search", { fallback: "Type to search" })}
        bind:value={textQuery}
        oninput={onQueryInput}
    />
</div>
