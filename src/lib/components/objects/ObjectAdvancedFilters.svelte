<script>
  import { fly, fade } from "svelte/transition";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import FilterDetailView from "./FilterDetailView.svelte";
  import FilterMainView from "./FilterMainView.svelte";
  import FilterTextSearchView from "./FilterTextSearchView.svelte";
  import { IconX } from "@tabler/icons-svelte";

  let {
    advancedFilters = $bindable({}),
    onFiltersChange = () => {},
    onClose = () => {},
    researchFields = [],
    ontologyFields = [],
    institutions = [],
    vocabularies = [],
    facets = {},
    enableInstitutionFilter = true,
  } = $props();

  const { t } = getTranslationStore();

  let pendingFilters = $state($state.snapshot(advancedFilters || {}));
  let activeView = $state("main");
  let selectedField = $state(null);
  let selectedFieldKind = $state(null);
  let searchTerm = $state("");
  let textKindResetCounter = $state(0);

  const institutionFacetMap = $derived.by(() => {
    const map = new Map();
    for (const row of facets?.institutions || []) {
      map.set(String(row.id), row.count || 0);
    }
    return map;
  });

  const researchFacetMap = $derived.by(() => {
    const map = new Map();
    for (const field of facets?.researchFields || []) {
      for (const option of field.options || []) {
        map.set(`${field.fieldId}:${option.id}`, option.count || 0);
      }
    }
    return map;
  });

  const pendingTextFilters = $derived(pendingFilters?.__textFilters ?? []);
  const appliedTextFilters = $derived(advancedFilters?.__textFilters ?? []);

  const visibleVocabularyFields = $derived(
    (researchFields || []).filter(
      (field) =>
        field?.id &&
        (field.type || "").toLowerCase() === "vocabulary" &&
        vocabularies.some((vocabulary) => String(vocabulary.field_id) === String(field.id))
    )
  );

  const visibleTextResearchFields = $derived(
    (researchFields || []).filter(
      (field) => field?.id && (field.type || "").toLowerCase() !== "vocabulary"
    )
  );

  const subViewFieldsList = $derived.by(() => {
    if (selectedFieldKind === "research") return visibleTextResearchFields;
    if (selectedFieldKind === "ontology") return ontologyFields;
    return [];
  });

  const selectedFieldKey = $derived(
    selectedField?.type === "institutions" ? "institutions" : selectedField?.id
  );

  const filteredItems = $derived.by(() => {
    if (activeView !== "detail" || !selectedField) return [];

    const baseItems = selectedField.type === "institutions"
      ? institutions.map((institution) => ({
          ...institution,
          name: institution?.name?.content || institution?.name || "",
        }))
      : vocabularies
          .filter((vocabulary) => String(vocabulary.field_id) === String(selectedField.id))
          .map((vocabulary) => ({
            ...vocabulary,
            name: vocabulary?.name?.content || vocabulary?.name || "",
          }));

    const term = searchTerm.trim().toLowerCase();
    const visibleItems = term
      ? baseItems.filter((item) => (item.name || "").toLowerCase().includes(term))
      : baseItems;

    return visibleItems.sort((left, right) => {
      const countDiff = getFacetCount(right) - getFacetCount(left);
      return countDiff || (left.name || "").localeCompare(right.name || "");
    });
  });

  const institutionCount = $derived(
    (advancedFilters?.institutions || []).filter((id) =>
      institutions.some((institution) => String(institution.id) === String(id))
    ).length
  );

  const vocabularyCountForField = (fieldId) =>
    (advancedFilters?.[fieldId] || []).filter((id) =>
      vocabularies.some(
        (vocabulary) =>
          String(vocabulary.field_id) === String(fieldId) && String(vocabulary.id) === String(id)
      )
    ).length;

  const textFilterCountForKind = (kind) =>
    appliedTextFilters.filter((textFilter) => textFilter.kind === kind).length;

  const getFacetCount = (item) => {
    if (!selectedField) return 0;
    if (selectedField.type === "institutions") {
      return institutionFacetMap.get(String(item.id)) ?? 0;
    }
    if (selectedField.type === "vocabulary") {
      return researchFacetMap.get(`${selectedField.id}:${item.id}`) ?? 0;
    }
    return 0;
  };

  const isSelected = (itemId) =>
    (pendingFilters?.[selectedFieldKey] || []).some((id) => String(id) === String(itemId));

  const getTextFieldLabel = (textFilter) => {
    const fields = textFilter?.kind === "ontology" ? ontologyFields : researchFields;
    const field = fields.find((entry) => String(entry.id) === String(textFilter.fieldId));
    return field?.name?.content || field?.name || t("filters.unknown-field", { fallback: "Unknown field" });
  };

  const activeTextFiltersForKind = (kind) =>
    pendingTextFilters.filter((textFilter) => textFilter.kind === kind);

  const toggleCheckboxFilter = (itemId) => {
    if (!selectedFieldKey) return;
    if (getFacetCount({ id: itemId }) === 0 && !isSelected(itemId)) return;

    const currentIds = pendingFilters?.[selectedFieldKey] || [];
    const nextIds = currentIds.some((id) => String(id) === String(itemId))
      ? currentIds.filter((id) => String(id) !== String(itemId))
      : [...currentIds, itemId];

    pendingFilters = { ...pendingFilters, [selectedFieldKey]: nextIds };
  };

  const clearCheckboxFilter = () => {
    if (!selectedFieldKey) return;
    pendingFilters = { ...pendingFilters, [selectedFieldKey]: [] };
  };

  const removeTextFilter = (textFilter) => {
    pendingFilters = {
      ...pendingFilters,
      __textFilters: (pendingFilters?.__textFilters || []).filter(
        (entry) =>
          !(entry.kind === textFilter.kind && String(entry.fieldId) === String(textFilter.fieldId))
      ),
    };
  };

  const applyFilters = () => {
    const nextFilters = $state.snapshot(pendingFilters || {});
    advancedFilters = nextFilters;
    onFiltersChange(nextFilters);
    onClose();
  };

  const resetAllFilters = () => {
    advancedFilters = {};
    onFiltersChange({});
    onClose();
  };

  const resetCurrentView = () => {
    if (activeView === "detail") {
      clearCheckboxFilter();
      return;
    }

    if (activeView === "textKind" && selectedFieldKind) {
      pendingFilters = {
        ...pendingFilters,
        __textFilters: (pendingFilters?.__textFilters || []).filter(
          (textFilter) => textFilter.kind !== selectedFieldKind
        ),
      };
      textKindResetCounter++;
    }
  };

  const showDetail = (field) => {
    selectedField = field;
    searchTerm = "";
    activeView = "detail";
  };

  const showTextKindView = (kind) => {
    selectedField = null;
    selectedFieldKind = kind;
    searchTerm = "";
    activeView = "textKind";
  };

  const showMain = () => {
    activeView = "main";
    selectedField = null;
    selectedFieldKind = null;
    searchTerm = "";
  };


</script>

<div
  class="position-fixed top-0 start-0 w-100 h-100"
  role="button"
  tabindex="0"
  style="background-color: rgba(0, 0, 0, 0.5); z-index: 1040;"
  onclick={onClose}
  onkeydown={onClose}
  transition:fade={{ duration: 150 }}
></div>

<div
  class="position-fixed top-0 end-0 vh-100 bg-white shadow d-flex flex-column"
  style="width: min(100%, 600px); z-index: 1050;"
  role="dialog"
  aria-modal="true"
  aria-labelledby="filters-title"
  transition:fly={{ x: 350, duration: 300 }}
>
  <div class="d-flex justify-content-between align-items-center px-3 py-4 flex-shrink-0">
    <p class="m-0 fs-5 fw-semibold" id="filters-title">{t("filters.title", { fallback: "Filters" })}</p>
    <button
      type="button"
      class="btn btn-link text-dark text-decoration-none p-0"
      aria-label={t("filters.close-filters", { fallback: "Close filters" })}
      onclick={onClose}
    >
      <IconX />
    </button>
  </div>

  <div class="flex-grow-1 overflow-auto">
    {#if activeView === "main"}
      <FilterMainView
        {enableInstitutionFilter}
        {institutionCount}
        {visibleVocabularyFields}
        {visibleTextResearchFields}
        {ontologyFields}
        {vocabularyCountForField}
        {textFilterCountForKind}
        onShowDetail={showDetail}
        onShowTextKind={showTextKindView}
      />
    {/if}

    {#if activeView === "textKind" && selectedFieldKind}
      {#key textKindResetCounter}
        <FilterTextSearchView
          kind={selectedFieldKind}
          fields={subViewFieldsList}
          currentFilters={activeTextFiltersForKind(selectedFieldKind)}
          onUpdate={(filters) => {
            const other = (pendingFilters?.__textFilters || []).filter(
              (tf) => tf.kind !== selectedFieldKind
            );
            pendingFilters = { ...pendingFilters, __textFilters: [...other, ...filters] };
          }}
          onBack={showMain}
        />
      {/key}
    {/if}

    {#if activeView === "detail" && selectedField}
      <FilterDetailView
        items={filteredItems}
        {selectedField}
        bind:searchTerm
        {isSelected}
        {getFacetCount}
        onToggle={toggleCheckboxFilter}
        onReset={clearCheckboxFilter}
        onBack={showMain}
      />
    {/if}
  </div>

  <div class="border-top p-3 d-flex justify-content-between gap-2 flex-shrink-0">
    {#if activeView === "main"}
      <button type="button" class="btn btn-outline-secondary" onclick={resetAllFilters}>
        {t("filters.reset-all", { fallback: "Reset all filters" })}
      </button>
      <button type="button" class="btn btn-secondary" onclick={onClose}>
        {t("filters.close", { fallback: "Close" })}
      </button>
    {:else}
      <button type="button" class="btn btn-outline-secondary" onclick={resetCurrentView}>
        {t("common.reset", { fallback: "Reset" })}
      </button>
      <button type="button" class="btn btn-primary" onclick={applyFilters}>
        {t("filters.apply", { fallback: "Apply filter" })}
      </button>
    {/if}
  </div>
</div>
