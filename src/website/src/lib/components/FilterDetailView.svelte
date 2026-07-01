<script>
    import { IconArrowLeft } from "@tabler/icons-svelte";
    import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';

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

    const { t } = getWebsiteTranslationStore();

    const fieldName = $derived(
        selectedField?.type === "institutions"
            ? t("common.institution", { fallback: "Institution" })
            : (selectedField?.name?.content || selectedField?.name || "")
    );

    const isVocabularyField = $derived(selectedField?.type === "vocabulary");

    const visibleItems = $derived(
        items.filter((item) => getFacetCount(item) > 0 || isSelected(item.id))
    );
</script>

<div class="p-3 d-flex flex-column gap-3 overflow-auto">
    <div class="d-flex align-items-center justify-content-between">
        <button class="btn btn-link text-decoration-none p-0 d-flex align-items-center gap-1" onclick={onBack}>
            <IconArrowLeft size={16} />
            <span class="fw-semibold">{fieldName}</span>
        </button>
    </div>

    <input
        type="text"
        class="form-control"
        placeholder={t("filters.search", { fallback: "Search..." })}
        bind:value={searchTerm}
    />

    <div class="list-group list-group-flush">
        {#each visibleItems as item (item.id)}
            <div class="list-group-item">
                <div class="d-flex align-items-center gap-2">
                    <input
                        class="form-check-input flex-shrink-0"
                        type="checkbox"
                        id={`filter-${selectedField.id}-${item.id}`}
                        checked={isSelected(item.id)}
                        onchange={() => onToggle(item.id)}
                    />
                    <label
                        class="form-check-label min-w-0 text-truncate d-block"
                        for={`filter-${selectedField.id}-${item.id}`}
                    >
                        <span class="fw-semibold">{item.name}</span>
                    </label>
                    <span class="text-muted small flex-shrink-0 ms-auto">{getFacetCount(item)}</span>
                </div>
            </div>
        {/each}
        {#if visibleItems.length === 0}
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
