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
    if (!selectedField) return;
    const fieldKey =
      selectedField.type === "institutions" ? "institutions" : selectedField.id;
    // Ensure advancedFilters is an object
    if (!advancedFilters || typeof advancedFilters !== "object") {
      advancedFilters = {};
    }
    // Initialize array for this field if absent or invalid
    if (!Array.isArray(advancedFilters[fieldKey])) {
      advancedFilters[fieldKey] = [];
    }
    const list = advancedFilters[fieldKey];
    const idx = list.findIndex((id) => String(id) === String(itemId));
    if (idx > -1) {
      list.splice(idx, 1);
    } else {
      list.push(itemId);
    }
    onFiltersChange(advancedFilters);
  }

  function resetFilter() {
    if (!selectedField) return;
    const fieldKey =
      selectedField.type === "institutions" ? "institutions" : selectedField.id;
    advancedFilters[fieldKey] = [];
    onFiltersChange(advancedFilters);
  }

  function isSelected(itemId) {
    const fieldKey =
      selectedField.type === "institutions" ? "institutions" : selectedField.id;
    const arr = Array.isArray(advancedFilters?.[fieldKey]) ? advancedFilters[fieldKey] : [];
    return arr.some((id) => String(id) === String(itemId));
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
      items = (vocabularies || []).filter(
        (v) => v.field_id === selectedField.id,
      );
    }
    const term = (searchTerm || "").toLowerCase().trim();
    let result = items;
    if (term) {
      result = items.filter((item) =>
        (item.name || "").toLowerCase().includes(term),
      );
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
      list.push({
        key: `o:${f.id}`,
        label: f.name?.content || f.name,
        kind: "ontology",
        id: f.id,
      }),
    );
    // Research fields that are NOT vocabulary-based
    (researchFields || [])
      .filter((f) => (f.type || "").toLowerCase() !== "vocabulary")
      .forEach((f) =>
        list.push({
          key: `r:${f.id}`,
          label: f.name?.content || f.name,
          kind: "research",
          id: f.id,
        }),
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
    const idx = arr.findIndex(
      (tf) => tf.kind === kind && String(tf.fieldId) === String(id),
    );

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
  // Debounce text query updates to avoid triggering searches on every key
  const debouncedUpdateTextFilter = debounce(() => {
    try {
      upsertOrRemoveTextFilter();
    } catch (e) {
      console.warn("debouncedUpdateTextFilter error:", e);
    }
  }, 1000);
  function onTextQueryInput() {
    debouncedUpdateTextFilter();
  }
  onDestroy(() => {
    debouncedUpdateTextFilter?.cancel?.();
  });

  let currentTextFilters = $derived.by(
    () => advancedFilters?.__textFilters ?? [],
  );
  function textFilterKey(tf) {
    return `${tf.kind}:${tf.fieldId}`;
  }
  function getTextFieldLabel(tf) {
    if (tf?.kind === "ontology") {
      const f = (ontologyFields || []).find(
        (o) => String(o.id) === String(tf.fieldId),
      );
      return f?.name?.content || f?.name || "Unknown field";
    }
    if (tf?.kind === "research") {
      const f = (researchFields || []).find(
        (r) => String(r.id) === String(tf.fieldId),
      );
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
    const idx = arr.findIndex(
      (x) => x.kind === tf.kind && String(x.fieldId) === String(tf.fieldId),
    );
    if (idx > -1) {
      arr.splice(idx, 1);
      onFiltersChange(advancedFilters);
    }
  }

  // Display helpers for main view rows
  function getInstitutionSelectionLabel() {
    const selected = advancedFilters?.institutions || [];
    if (!selected.length) return "All";
    const names = (institutions || [])
      .filter((inst) => selected.some((id) => String(id) === String(inst.id)))
      .map((inst) => inst?.name?.content || inst?.name || "")
      .filter(Boolean);
    return names.length ? names.join(", ") : "All";
  }

  function getVocabularySelectionLabel(fieldId) {
    const selected = advancedFilters?.[fieldId] || [];
    if (!selected.length) return "All";
    const names = (vocabularies || [])
      .filter(
        (v) =>
          String(v.field_id) === String(fieldId) &&
          selected.some((id) => String(id) === String(v.id)),
      )
      .map((v) => v?.name?.content || v?.name || v?.option?.content || "")
      .filter(Boolean);
    return names.length ? names.join(", ") : "All";
  }

  // Label helpers for textual research and ontology fields
  function getCurrentTextQuery(kind, fieldId) {
    const tf = (currentTextFilters || []).find(
      (x) => x.kind === kind && String(x.fieldId) === String(fieldId),
    );
    return (tf?.query || "").trim();
  }

  function getTextResearchSelectionLabel(fieldId) {
    const q = getCurrentTextQuery("research", fieldId);
    return q ? q : "All";
  }

  function getOntologyTextSelectionLabel(fieldId) {
    const q = getCurrentTextQuery("ontology", fieldId);
    return q ? q : "All";
  }

  function getResearchFieldSelectionLabel(field) {
    const isVocab = (field.type || "").toLowerCase() === "vocabulary";
    return isVocab
      ? getVocabularySelectionLabel(field.id)
      : getTextResearchSelectionLabel(field.id);
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
            onclick={() =>
              showDetail({ type: "institutions", id: "institutions" })}
            aria-label="Filter by institution"
          >
            <div class="fw-semibold">Institution</div>
            <div class="d-flex align-items-center gap-2">
              <span class="text-muted ps-3"
                >{getInstitutionSelectionLabel()}</span
              >
              <i class="bi bi-chevron-right"></i>
            </div>
          </button>
        {/if}

        <div class="px-3 py-3 text-muted">Research fields</div>

        {#each researchFields || [] as field (field.id)}
          <button
            type="button"
            class="list-group-item list-group-item-action d-flex align-items-center justify-content-between py-3"
            onclick={() =>
              (field.type || "").toLowerCase() === "vocabulary"
                ? showDetail({ type: "vocabulary", id: field.id })
                : showAddTextSearch(
                    `r:${field.id}`,
                    getCurrentTextQuery("research", field.id),
                  )}
            aria-label={`Filter by ${field.name?.content || field.name}`}
          >
            <div class="fw-semibold">{field.name?.content || field.name}</div>
            <div class="d-flex align-items-center gap-2">
              <span class="text-muted ps-3"
                >{getResearchFieldSelectionLabel(field)}</span
              >
              <i class="bi bi-chevron-right"></i>
            </div>
          </button>
        {/each}

        <!-- Ontology fields list removed; use Active text filters overview -->

        <!-- Active text filters overview (shown in main list) -->
        <div class="list-group-item py-3">
          <div
            class="d-flex flex-column justify-content-between align-items-start"
          >
            <div class="text-muted mb-2">Institution fields</div>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              onclick={() => showAddTextSearch()}
            >
              <i class="bi bi-plus-circle"></i> Add instituion field filter
            </button>
          </div>

          {#each currentTextFilters as tf (textFilterKey(tf))}
            <div
              class="d-flex align-items-center justify-content-between border rounded p-2 mb-2 mt-2"
            >
              <div>
                <div class="fw-semibold">{getTextFieldLabel(tf)}</div>
                <div class="text-muted fs-7">"{tf.query}"</div>
              </div>
              <div class="d-flex gap-2">
                <button
                  class="btn btn-outline-secondary btn-sm"
                  onclick={() => editTextFilter(tf)}
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  class="btn btn-outline-danger btn-sm"
                  onclick={() => removeTextFilter(tf)}
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
        onchange={onTextFieldChange}
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
        oninput={onTextQueryInput}
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
