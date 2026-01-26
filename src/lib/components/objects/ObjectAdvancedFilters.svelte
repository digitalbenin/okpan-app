<script>
  import { fly, fade } from "svelte/transition";
  import { debounce } from "$lib/utils/throttle.js";
  import { onDestroy } from "svelte";

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

  // State
  let activeView = $state("main");
  let selectedField = $state(null);
  let searchTerm = $state("");
  let textSelectedFieldId = $state("");
  let textQuery = $state("");

  // Derived - Facet lookup maps
  const institutionFacetMap = $derived.by(() => {
    const map = new Map();
    (facets?.institutions || []).forEach((row) => map.set(String(row.id), row.count || 0));
    return map;
  });

  const researchFacetMap = $derived.by(() => {
    const map = new Map();
    (facets?.researchFields || []).forEach((field) => {
      (field.options || []).forEach((opt) => map.set(`${field.fieldId}:${opt.id}`, opt.count || 0));
    });
    return map;
  });

  const currentTextFilters = $derived(advancedFilters?.__textFilters ?? []);

  const filteredItems = $derived.by(() => {
    if (activeView !== "detail" || !selectedField) return [];
    
    let items = selectedField.type === "institutions"
      ? institutions.map((inst) => ({ ...inst, name: inst?.name?.content || inst?.name || "" }))
      : vocabularies.filter((v) => v.field_id === selectedField.id);

    const term = searchTerm.toLowerCase().trim();
    if (term) items = items.filter((item) => (item.name || "").toLowerCase().includes(term));

    return items.sort((a, b) => {
      const countDiff = getFacetCountForItem(b) - getFacetCountForItem(a);
      return countDiff || (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
    });
  });

  const selectableTextFields = $derived.by(() => {
    const fields = [
      ...ontologyFields.map((f) => ({ key: `o:${f.id}`, label: f.name?.content || f.name, kind: "ontology", id: f.id })),
      ...researchFields.filter((f) => (f.type || "").toLowerCase() !== "vocabulary")
        .map((f) => ({ key: `r:${f.id}`, label: f.name?.content || f.name, kind: "research", id: f.id })),
    ];
    return fields.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  });

  const textResearchFields = $derived.by(() =>
    (researchFields || []).filter((f) => (f.type || "").toLowerCase() !== "vocabulary")
  );

  const connectionResearchFields = $derived.by(() =>
    (researchFields || []).filter((f) => (f.type || "").toLowerCase() === "vocabulary")
  );

  // Helpers
  const getFieldKey = () => selectedField?.type === "institutions" ? "institutions" : selectedField?.id;
  
  const ensureFiltersObject = () => {
    if (!advancedFilters || typeof advancedFilters !== "object") advancedFilters = {};
    return advancedFilters;
  };

  const ensureTextFiltersArray = () => {
    ensureFiltersObject();
    if (!Array.isArray(advancedFilters.__textFilters)) advancedFilters.__textFilters = [];
    return advancedFilters.__textFilters;
  };

  const parseKind = (val) => {
    const [k, id] = (val || "").split(":");
    if (k === "o") return { kind: "ontology", id };
    if (k === "r") return { kind: "research", id };
    return { kind: null, id: null };
  };

  const triggerChange = () => {
    advancedFilters = { ...advancedFilters };
    onFiltersChange(advancedFilters);
  };

  const getFacetCountForItem = (item) => {
    if (!selectedField) return 0;
    if (selectedField.type === "institutions") return institutionFacetMap.get(item.id) ?? 0;
    if (selectedField.type === "vocabulary") return researchFacetMap.get(`${selectedField.id}:${item.id}`) ?? 0;
    return 0;
  };

  const getFieldLabel = (kind, fieldId, fieldsList) => {
    const field = fieldsList.find((f) => String(f.id) === String(fieldId));
    return field?.name?.content || field?.name || "Unknown field";
  };

  const getTextFieldLabel = (tf) => {
    return tf?.kind === "ontology"
      ? getFieldLabel("ontology", tf.fieldId, ontologyFields)
      : getFieldLabel("research", tf.fieldId, researchFields);
  };

  const getCurrentTextQuery = (kind, fieldId) => {
    const tf = currentTextFilters.find((x) => x.kind === kind && String(x.fieldId) === String(fieldId));
    return tf?.query?.trim() || "";
  };

  const getSelectionLabel = (selectedIds, items, fieldId = null) => {
    if (!selectedIds || !selectedIds.length) return "All";
    const filtered = items.filter((item) => {
      const matchesField = !fieldId || String(item.field_id) === String(fieldId);
      return matchesField && selectedIds.some((id) => String(id) === String(item.id));
    });
    const names = filtered.map((item) => item?.name?.content || item?.name || item?.option?.content || "").filter(Boolean);
    return names.length ? names.join(", ") : "All";
  };

  const getResearchFieldSelectionLabel = (field) => {
    const isVocab = (field.type || "").toLowerCase() === "vocabulary";
    return isVocab
      ? getSelectionLabel(advancedFilters?.[field.id], vocabularies, field.id)
      : getCurrentTextQuery("research", field.id) || "All";
  };

  // Navigation
  const showDetail = (field) => {
    selectedField = field;
    activeView = "detail";
  };

  const showAddTextSearch = (prefillKey = "", prefillQuery = "") => {
    activeView = "addText";
    textSelectedFieldId = prefillKey;
    textQuery = prefillQuery;
  };

  const showMain = () => {
    activeView = "main";
    searchTerm = "";
  };

  // Filter actions
  const toggleFilter = (itemId) => {
    if (!selectedField) return;
    ensureFiltersObject();
    const fieldKey = getFieldKey();
    
    // Get current array or create new one
    const currentArray = Array.isArray(advancedFilters[fieldKey]) 
      ? [...advancedFilters[fieldKey]] 
      : [];
    
    const idx = currentArray.findIndex((id) => String(id) === String(itemId));
    
    if (idx > -1) {
      currentArray.splice(idx, 1);
    } else {
      currentArray.push(itemId);
    }
    
    // Update with spread to trigger reactivity
    advancedFilters = {
      ...advancedFilters,
      [fieldKey]: currentArray
    };
    
    onFiltersChange(advancedFilters);
  };

  const resetFilter = () => {
    if (!selectedField) return;
    advancedFilters = { ...advancedFilters, [getFieldKey()]: [] };
    onFiltersChange(advancedFilters);
  };

  const isSelected = (itemId) => {
    const arr = Array.isArray(advancedFilters?.[getFieldKey()]) ? advancedFilters[getFieldKey()] : [];
    return arr.some((id) => String(id) === String(itemId));
  };

  // Text filter actions
  const upsertOrRemoveTextFilter = () => {
    const { kind, id } = parseKind(textSelectedFieldId.trim());
    const q = textQuery.trim();
    if (!kind || !id) return;

    const arr = ensureTextFiltersArray();
    const idx = arr.findIndex((tf) => tf.kind === kind && String(tf.fieldId) === String(id));

    if (!q && idx > -1) arr.splice(idx, 1);
    else if (q) {
      const filter = { kind, fieldId: id, query: q };
      if (idx > -1) arr[idx] = filter;
      else arr.push(filter);
    }
    
    triggerChange();
  };

  const editTextFilter = (tf) => {
    showAddTextSearch(`${tf.kind === "ontology" ? "o" : "r"}:${tf.fieldId}`, tf.query || "");
  };

  const removeTextFilter = (tf) => {
    const arr = ensureTextFiltersArray();
    const idx = arr.findIndex((x) => x.kind === tf.kind && String(x.fieldId) === String(tf.fieldId));
    if (idx > -1) {
      arr.splice(idx, 1);
      triggerChange();
    }
  };

  const debouncedUpdateTextFilter = debounce(() => {
    try {
      upsertOrRemoveTextFilter();
    } catch (e) {
      console.warn("debouncedUpdateTextFilter error:", e);
    }
  }, 1000);

  onDestroy(() => debouncedUpdateTextFilter?.cancel?.());

</script>

<!-- Backdrop -->
<div
  class="position-fixed top-0 start-0 w-100 h-100"
  onkeydown={onClose}
  role="button"
  tabindex="0"
  style="background-color: rgba(0, 0, 0, 0.5); z-index: 1040;"
  onclick={onClose}
  transition:fade={{ duration: 150 }}
></div>

<!-- Side Panel -->
<div
  class="position-fixed top-0 end-0 vh-100 bg-white shadow d-flex flex-column"
  style="width: min(100%, 450px); max-width: 100%; z-index: 1050;"
  transition:fly={{ x: 350, duration: 300 }}
  role="dialog"
  aria-modal="true"
  aria-labelledby="filters-title"
>
  <div
    class="d-flex justify-content-between align-items-center px-3 py-4 border-bottom"
  >
    <h5 class="m-0" id="filters-title">Filters</h5>
    <button
      type="button"
      class="btn btn-link text-dark text-decoration-none p-0"
      aria-label="Close filters"
      onclick={onClose}
    >
      <i class="bi bi-x fs-3"></i>
    </button>
  </div>

  {#if activeView === "main"}
    <div class="p-3 overflow-auto">
      <div class="list-group list-group-flush">
            {#if enableInstitutionFilter}
              <button
                type="button"
                class="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-3"
                onclick={() => showDetail({ type: "institutions", id: "institutions" })}
                aria-label="Filter by institution"
              >
                <div class="fw-semibold">Institution</div>
                <div class="d-flex align-items-center gap-2">
                  <span class="text-muted ps-3">{getSelectionLabel(advancedFilters?.institutions, institutions)}</span>
                  <i class="bi bi-chevron-right"></i>
                </div>
              </button>
            {/if}

              {#if connectionResearchFields.length > 0}
          <div class="mt-3 px-3 pt-3 text-muted">Connections</div>

          {#each connectionResearchFields as field (field.id)}
            <button
              type="button"
              class="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-3"
              onclick={() => showDetail({ type: "vocabulary", id: field.id })}
              aria-label={`Filter by ${field.name?.content || field.name}`}
            >
              <div class="fw-semibold">{field.name?.content || field.name}</div>
              <div class="d-flex align-items-center gap-2">
                <span class="text-muted ps-3">{getResearchFieldSelectionLabel(field)}</span>
                <i class="bi bi-chevron-right"></i>
              </div>
            </button>
          {/each}
        {/if}

        <div class="mt-3 px-3 pt-3 text-muted">Research fields</div>

            {#each textResearchFields as field (field.id)}
              <button
                type="button"
                class="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-3"
                onclick={() => showAddTextSearch(`r:${field.id}`, getCurrentTextQuery("research", field.id))}
                aria-label={`Filter by ${field.name?.content || field.name}`}
              >
                <div class="fw-semibold">{field.name?.content || field.name}</div>
                <div class="d-flex align-items-center gap-2">
                  <span class="text-muted ps-3">{getResearchFieldSelectionLabel(field)}</span>
                  <i class="bi bi-chevron-right"></i>
                </div>
              </button>
            {/each}

        

    
        <!-- Active text filters overview (shown in main list) -->
        <div class="list-group-item py-3">
          <div
            class="d-flex flex-column justify-content-between align-items-start"
          >
            <div class="text-muted pb-3 mt-3">Institution fields</div>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              onclick={() => showAddTextSearch()}
            >
              <i class="bi bi-plus-circle"></i> Add instituion field filter
            </button>
          </div>

            {#each currentTextFilters as tf (`${tf.kind}:${tf.fieldId}`)}
              <div class="d-flex align-items-center justify-content-between border rounded p-2 mb-2 mt-2">
                <div>
                  <div class="fw-semibold">{getTextFieldLabel(tf)}</div>
                  <div class="text-muted fs-7">"{tf.query}"</div>
                </div>
                <div class="d-flex gap-2">
                  <button
                    class="btn btn-outline-secondary btn-sm"
                    onclick={() => editTextFilter(tf)}
                    aria-label="Edit filter"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button
                    class="btn btn-outline-danger btn-sm"
                    onclick={() => removeTextFilter(tf)}
                    aria-label="Remove filter"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            {/each}
        </div>
      </div>
    </div>
  {/if}

  {#if activeView === "detail" && selectedField}
    <div class="p-3 d-flex flex-column gap-3 overflow-auto">
      <div class="d-flex align-items-center justify-content-between">
        <button class="btn btn-link text-decoration-none" onclick={showMain}>
          <i class="bi bi-arrow-left"></i>
          Back
        </button>
        <button class="btn btn-outline-secondary btn-sm" onclick={resetFilter}
          >Reset</button
        >
      </div>

      <div class="position-relative">
        <input
          type="text"
          class="form-control"
          placeholder="Search..."
          bind:value={searchTerm}
        />
      </div>

      <div class="list-group list-group-flush">
        {#each filteredItems as item (item.id)}
          <div class="list-group-item">
            <div class="d-flex align-items-center gap-2">
              <input
                class="form-check-input"
                type="checkbox"
                id={`filter-${selectedField.id}-${item.id}`}
                checked={isSelected(item.id)}
                onchange={() => toggleFilter(item.id)}
              />
              <label
                class="form-check-label"
                for={`filter-${selectedField.id}-${item.id}`}
              >
                <span class="fw-semibold">{item.name}</span>
                <span class="text-muted fs-7">
                  ({getFacetCountForItem(item)})</span
                >
              </label>
            </div>
          </div>
        {/each}
        {#if filteredItems.length === 0}
          <div class="text-muted text-center py-3">No items</div>
        {/if}
      </div>
    </div>
  {/if}

  {#if activeView === "addText"}
    <div class="p-3 d-flex flex-column gap-3 overflow-auto">
      <div class="d-flex align-items-center justify-content-between">
        <button class="btn btn-link text-decoration-none" onclick={showMain}>
          <i class="bi bi-arrow-left"></i>
          Back
        </button>
      </div>

      <div class="mb-2">Select a field</div>
      <select
        class="form-select"
        bind:value={textSelectedFieldId}
        onchange={upsertOrRemoveTextFilter}
      >
        <option value="">Choose...</option>
        {#each selectableTextFields as f (f.key)}
          <option value={f.key}>{f.label}</option>
        {/each}
      </select>

      <div class="mb-2">Enter query</div>
      <input
        type="text"
        class="form-control"
        placeholder="Type to search"
        bind:value={textQuery}
        oninput={() => debouncedUpdateTextFilter()}
      />
    </div>
  {/if}
</div>

<style>
  .list-group-item {
    border: none;
    border-bottom: 1px solid var(--bs-border-color);
  }
</style>
