<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    let {
        items = [],
        selectedField,
        searchTerm = $bindable(""),
        isSelected,
        getFacetCount,
        onToggle,
        onReset,
        onBack,
    } = $props();

    const { t } = getTranslationStore();

    const isDisabled = (item) => getFacetCount(item) === 0 && !isSelected(item.id);
</script>

<div class="p-3 d-flex flex-column gap-3 overflow-auto">
    <div class="d-flex align-items-center justify-content-between">
        <button class="btn btn-link text-decoration-none" onclick={onBack}>
            <i class="bi bi-arrow-left"></i>
            {t("nav.back", { fallback: "Back" })}
        </button>
        <button class="btn btn-outline-secondary btn-sm" onclick={onReset}>
            {t("common.reset", { fallback: "Reset" })}
        </button>
    </div>

    <input
        type="text"
        class="form-control"
        placeholder={t("filters.search", { fallback: "Search..." })}
        bind:value={searchTerm}
    />

    <div class="list-group list-group-flush">
        {#each items as item (item.id)}
            <div class="list-group-item" class:opacity-50={isDisabled(item)}>
                <div class="d-flex align-items-center gap-2">
                    <input
                        class="form-check-input"
                        type="checkbox"
                        id={`filter-${selectedField.id}-${item.id}`}
                        checked={isSelected(item.id)}
                        disabled={isDisabled(item)}
                        onchange={() => onToggle(item.id)}
                    />
                    <label
                        class="form-check-label"
                        class:pe-none={isDisabled(item)}
                        for={`filter-${selectedField.id}-${item.id}`}
                    >
                        <span class="fw-semibold">{item.name}</span>
                        <span class="text-muted fs-7">({getFacetCount(item)})</span>
                    </label>
                </div>
            </div>
        {/each}
        {#if items.length === 0}
            <div class="text-muted text-center py-3">{t("filters.no-items", { fallback: "No items" })}</div>
        {/if}
    </div>
</div>

<style>
    .list-group-item {
        border: none;
        border-bottom: 1px solid var(--bs-border-color);
    }
</style>
