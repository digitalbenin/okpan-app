<script>
  import { fly, fade } from "svelte/transition";

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

  let activeView = $state("main");
  let selectedField = $state(null);
  let searchTerm = $state("");
  let openInfoId = $state(null);

  let textSelectedFieldId = $state(""); // encoded kind:id (e.g., "o:12" or "r:34")
  let textQuery = $state("");

  // Build facet lookup maps (optional; safe defaults)
  let institutionFacetMap = $derived.by(() => {
    const map = new Map();
    const list = facets?.institutions || [];
    for (const row of list) {
      const id = row.id;
      map.set(String(id), row.count || 0);
    }
    return map;
  });

  let researchFacetMap = $derived.by(() => {
    const map = new Map();
    const fields = facets?.researchFields || [];
    for (const field of fields) {
      const fid = field.fieldId;
      for (const opt of field.options || []) {
        map.set(`${fid}:${opt.id}`, opt.count || 0);
      }
    }
    return map;
  });

  function showDetail(field) {
    selectedField = field;
    activeView = "detail";
    openInfoId = null;
  }

  function showAddTextSearch(prefillKey = "", prefillQuery = "") {
    activeView = "addText";
    textSelectedFieldId = prefillKey;
    textQuery = prefillQuery;
  }

  function toggleFilter(itemId) {
    const fieldKey = selectedField.type === "institutions" ? "institutions" : selectedField.id;
    if (!advancedFilters[fieldKey]) {
      advancedFilters[fieldKey] = [];
    }
    const index = advancedFilters[fieldKey].indexOf(itemId);
    if (index > -1) {
      advancedFilters[fieldKey].splice(index, 1);
    } else {
      advancedFilters[fieldKey].push(itemId);
    }
    onFiltersChange(advancedFilters);
  }

  function resetFilter() {
    if (!selectedField) return;
    const fieldKey = selectedField.type === "institutions" ? "institutions" : selectedField.id;
    advancedFilters[fieldKey] = [];
    onFiltersChange(advancedFilters);
  }

  function isSelected(itemId) {
    const fieldKey = selectedField.type === "institutions" ? "institutions" : selectedField.id;
    return advancedFilters[fieldKey] && advancedFilters[fieldKey].includes(itemId);
  }

  function showMain() {
    activeView = "main";
    searchTerm = "";
    openInfoId = null;
  }

  function getFacetCountForItem(item) {
    if (!selectedField) return 0;
    if (selectedField.type === "institutions") {
      return institutionFacetMap.get(item.id) ?? 0;
    }
    if (selectedField.type === "vocabulary") {
      return researchFacetMap.get(`${selectedField.id}:${item.id}`) ?? 0;
    }
    return 0;
  }

  function toggleInfo(item) {
    openInfoId = openInfoId === item.id ? null : item.id;
  }

  // Compute filtered items reactively
  let filteredItems = $derived.by(() => {
    if (activeView !== "detail" || !selectedField) return [];
    let items = [];
    if (selectedField.type === "institutions") {
      items = (institutions || []).map((inst) => ({
        ...inst,
        name: inst?.name?.content || inst?.name || "",
      }));
    } else if (selectedField.type === "vocabulary") {
      items = (vocabularies || []).filter((v) => v.field_id === selectedField.id);
    }
    const term = (searchTerm || "").toLowerCase().trim();
    let result = items;
    if (term) {
      result = items.filter((item) => (item.name || "").toLowerCase().includes(term));
    }
    // Sort by facet count desc; tiebreak by name asc
    result = [...result].sort((a, b) => {
      const countB = getFacetCountForItem(b);
      const countA = getFacetCountForItem(a);
      if (countB !== countA) return countB - countA;
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
    return result;
  });

  // Selectable text fields for freetext queries
  let selectableTextFields = $derived.by(() => {
    const list = [];
    // Ontology fields
    (ontologyFields || []).forEach((f) =>
      list.push({ key: `o:${f.id}`, label: f.name?.content || f.name, kind: "ontology", id: f.id })
    );
    // Research fields that are NOT vocabulary-based
    (researchFields || [])
      .filter((f) => (f.type || "").toLowerCase() !== "vocabulary")
      .forEach((f) =>
        list.push({ key: `r:${f.id}`, label: f.name?.content || f.name, kind: "research", id: f.id })
      );
    return list.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  });

  function ensureTextFiltersArray() {
    if (!advancedFilters.__textFilters) advancedFilters.__textFilters = [];
    return advancedFilters.__textFilters;
  }

  function parseKind(val) {
    const [k, id] = (val || "").split(":");
    if (k === "o") return { kind: "ontology", id };
    if (k === "r") return { kind: "research", id };
    return { kind: null, id: null };
  }

  function upsertOrRemoveTextFilter() {
    const val = (textSelectedFieldId || "").trim();
    const q = (textQuery || "").trim();
    const { kind, id } = parseKind(val);
    if (!kind || !id) return;

    const arr = ensureTextFiltersArray();
    const idx = arr.findIndex((tf) => tf.kind === kind && String(tf.fieldId) === String(id));

    if (!q) {
      if (idx > -1) arr.splice(idx, 1);
    } else {
      const next = { kind, fieldId: id, query: q };
      if (idx > -1) arr[idx] = next;
      else arr.push(next);
    }
    onFiltersChange(advancedFilters);
  }

  function onTextFieldChange() {
    upsertOrRemoveTextFilter();
  }
  function onTextQueryInput() {
    upsertOrRemoveTextFilter();
  }

  let currentTextFilters = $derived.by(() => advancedFilters?.__textFilters ?? []);
  function textFilterKey(tf) {
    return `${tf.kind}:${tf.fieldId}`;
  }
  function getTextFieldLabel(tf) {
    if (tf?.kind === "ontology") {
      const f = (ontologyFields || []).find((o) => String(o.id) === String(tf.fieldId));
      return f?.name?.content || f?.name || "Unknown field";
    }
    if (tf?.kind === "research") {
      const f = (researchFields || []).find((r) => String(r.id) === String(tf.fieldId));
      return f?.name?.content || f?.name || "Unknown field";
    }
    return "Unknown field";
  }
  function editTextFilter(tf) {
    const key = `${tf.kind === "ontology" ? "o" : "r"}:${tf.fieldId}`;
    showAddTextSearch(key, tf.query || "");
  }
  function removeTextFilter(tf) {
    const arr = ensureTextFiltersArray();
    const idx = arr.findIndex((x) => x.kind === tf.kind && String(x.fieldId) === String(tf.fieldId));
    if (idx > -1) {
      arr.splice(idx, 1);
      onFiltersChange(advancedFilters);
    }
  }
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
  <div class="d-flex justify-content-between align-items-center px-3 py-4 border-bottom">
    <h5 class="m-0" id="filters-title">Filters</h5>
    <button type="button" class="btn btn-link text-dark text-decoration-none p-0" aria-label="Close filters" onclick={onClose}>
      <i class="bi bi-x fs-3"></i>
    </button>
  </div>

  {#if activeView === "main"}
    <div class="p-3 d-flex flex-column gap-3 overflow-auto">
      {#if enableInstitutionFilter}
        <div class="border rounded-3 p-3">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="fw-semibold">Institutions</div>
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick={() => showDetail({ type: "institutions", id: "institutions" })}>
              Select
            </button>
          </div>
          <div class="text-muted fs-7">Filter objects by institution</div>
        </div>
      {/if}

      <!-- Research fields (vocabularies only) -->
      <div class="border rounded-3 p-3">
        <div class="fw-semibold mb-2">Research fields</div>
        <div class="d-flex flex-column gap-2">
          {#each (researchFields || []).filter((f) => (f.type || "").toLowerCase() === "vocabulary") as field (field.id)}
            <div class="d-flex align-items-center justify-content-between">
              <div class="text-truncate">{field.name?.content || field.name}</div>
              <button type="button" class="btn btn-outline-secondary btn-sm" onclick={() => showDetail({ type: "vocabulary", id: field.id })}>
                Select
              </button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Add text search -->
      <div class="border rounded-3 p-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-semibold">Add search field</div>
          <button type="button" class="btn btn-outline-secondary btn-sm" onclick={() => showAddTextSearch()}>
            Add
          </button>
        </div>
        <div class="text-muted fs-7">Search in a specific field (ontology or research field)</div>
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
        <button class="btn btn-outline-secondary btn-sm" onclick={resetFilter}>Reset</button>
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
          <div class="list-group-item d-flex align-items-start justify-content-between gap-2">
            <div class="d-flex align-items-start gap-2 w-100">
              <div class="flex-grow-1">
                <div class="fw-semibold">{item.name}</div>
                <div class="text-muted fs-7">Facet count: {getFacetCountForItem(item)}</div>
                {#if selectedField.type === "vocabulary"}
                  {#if openInfoId === item.id}
                    <div class="text-muted fs-7">Vocabulary ID: {item.id}</div>
                  {/if}
                {/if}
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button class="btn btn-sm btn-outline-secondary" onclick={() => toggleInfo(item)} aria-expanded={openInfoId === item.id}>
                <i class="bi bi-info-circle"></i>
              </button>
              <button
                class="btn btn-sm"
                class:btn-primary={!isSelected(item.id)}
                class:btn-secondary={isSelected(item.id)}
                onclick={() => toggleFilter(item.id)}
              >
                {#if isSelected(item.id)}Remove{:else}Add{/if}
              </button>
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
      <select class="form-select" bind:value={textSelectedFieldId} onchange={onTextFieldChange}>
        <option value="">Choose...</option>
        {#each selectableTextFields as f (f.key)}
          <option value={f.key}>{f.label}</option>
        {/each}
      </select>

      <div class="mb-2">Enter query</div>
      <input type="text" class="form-control" placeholder="Type to search" bind:value={textQuery} oninput={onTextQueryInput} />

      <!-- Current text filters -->
      <div class="mt-3">
        <div class="fw-semibold mb-2">Active text filters</div>
        {#each currentTextFilters as tf (textFilterKey(tf))}
          <div class="d-flex align-items-center justify-content-between border rounded p-2 mb-2">
            <div>
              <div class="fw-semibold">{getTextFieldLabel(tf)}</div>
              <div class="text-muted fs-7">"{tf.query}"</div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-outline-secondary btn-sm" onclick={() => editTextFilter(tf)}>
                Edit
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick={() => removeTextFilter(tf)}>
                Remove
              </button>
            </div>
          </div>
        {/each}
        {#if currentTextFilters.length === 0}
          <div class="text-muted fs-7">No text filters</div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .list-group-item {
    border: none;
    border-bottom: 1px solid var(--bs-border-color);
  }
</style>