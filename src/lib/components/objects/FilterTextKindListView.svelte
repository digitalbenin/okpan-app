<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    selectedFieldKind,
    subViewFieldsList = [],
    pendingTextFilters = [],
    activeTextFiltersForKind,
    getTextFieldLabel,
    onBack,
    onShowAddTextSearch,
    onEditTextFilter,
    onRemoveTextFilter,
  } = $props();

  const { t } = getTranslationStore();
</script>

<div class="p-3 d-flex flex-column gap-3">
  <button class="btn btn-link text-decoration-none p-0 align-self-start" onclick={onBack}>
    <i class="bi bi-arrow-left"></i>
    {t("nav.back", { fallback: "Back" })}
  </button>

  {#each subViewFieldsList as field (field.id)}
    {@const activeTextFilter = pendingTextFilters.find(
      (textFilter) =>
        textFilter.kind === selectedFieldKind && String(textFilter.fieldId) === String(field.id)
    )}
    <button
      type="button"
      class="d-flex align-items-center justify-content-between w-100 py-3 border-0 bg-transparent border-bottom"
      onclick={() =>
        onShowAddTextSearch(
          `${selectedFieldKind === "ontology" ? "o" : "r"}:${field.id}`,
          activeTextFilter?.query || ""
        )}
    >
      <div class="text-start">{field.name?.content || field.name}</div>
      <div class="d-flex align-items-center gap-2">
        {#if activeTextFilter?.query}
          <span class="text-truncate" style="max-width: 120px;">{activeTextFilter.query}</span>
        {/if}
        <i class="bi bi-chevron-right"></i>
      </div>
    </button>
  {/each}

  {#if subViewFieldsList.length === 0}
    <div class="text-center py-3">{t("filters.no-items", { fallback: "No items" })}</div>
  {/if}

  {#if activeTextFiltersForKind(selectedFieldKind).length > 0}
    <div class="mt-3">
      <div class="small text-uppercase py-2" style="font-size: 12px; letter-spacing: 0.24px;">
        {t("filters.active-filters", { fallback: "Active filters" })}
      </div>

      {#each activeTextFiltersForKind(selectedFieldKind) as textFilter (`${textFilter.kind}:${textFilter.fieldId}`)}
        <div class="d-flex align-items-center justify-content-between border rounded p-2 mb-2 gap-2">
          <div>
            <div>{getTextFieldLabel(textFilter)}</div>
            <div class="small">"{textFilter.query}"</div>
          </div>
          <div class="d-flex gap-2">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              aria-label={t("filters.edit-filter", { fallback: "Edit filter" })}
              onclick={() => onEditTextFilter(textFilter)}
            >
              <i class="bi bi-pencil"></i>
            </button>
            <button
              type="button"
              class="btn btn-outline-danger btn-sm"
              aria-label={t("filters.remove-filter", { fallback: "Remove filter" })}
              onclick={() => onRemoveTextFilter(textFilter)}
            >
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>