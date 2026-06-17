<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconCirclePlus, IconCircleX, IconArrowLeft, IconSearch } from "@tabler/icons-svelte"

  let {
    kind,
    fields = [],
    currentFilters = [],
    onUpdate,
    onBack,
  } = $props();

  const { t } = getTranslationStore();

  const kindLabel = $derived(
    kind === "research"
      ? t("filters.custom-fields", { fallback: "Custom fields" })
      : t("filters.institution-mapped-fields", { fallback: "Institution mapped fields" })
  );

  let rows = $state(
    currentFilters.length > 0
      ? currentFilters.map((filter, index) => ({
          localId: index,
          fieldId: String(filter.fieldId),
          query: filter.query,
        }))
      : [{ localId: 0, fieldId: "", query: "" }]
  );

  let nextId = $state(currentFilters.length > 0 ? currentFilters.length : 1);

  const canAddRow = $derived(
    rows.every((row) => row.fieldId && row.query.trim())
  );

  const addRow = () => {
    rows = [...rows, { localId: nextId++, fieldId: "", query: "" }];
  };

  const removeRow = (localId) => {
    const remaining = rows.filter((row) => row.localId !== localId);
    rows = remaining.length > 0 ? remaining : [{ localId: nextId++, fieldId: "", query: "" }];
    syncToParent();
  };

  const updateRow = (localId, patch) => {
    rows = rows.map((row) =>
      row.localId === localId ? { ...row, ...patch } : row
    );
    syncToParent();
  };

  const syncToParent = () => {
    const filters = rows
      .filter((row) => row.fieldId && row.query.trim())
      .map((row) => ({
        kind,
        fieldId: row.fieldId,
        query: row.query.trim(),
      }));
    onUpdate(filters);
  };
</script>

<div class="p-3 d-flex flex-column gap-3">
  <button class="btn btn-link text-decoration-none p-0 align-self-start d-flex align-items-center gap-1" onclick={onBack}>
    <IconArrowLeft size={16} />
    <span class="fw-semibold">{kindLabel}</span>
  </button>

  {#each rows as row (row.localId)}
    <div class="d-flex align-items-center gap-2">
      <div class="input-group flex-grow-1">
        <input
          type="text"
          class="form-control"
          placeholder={t("filters.type-to-search", { fallback: "Type to search" })}
          value={row.query}
          oninput={(e) => updateRow(row.localId, { query: e.target.value })}
        />
        <span class="input-group-text">
          <IconSearch />
        </span>
      </div>
      <select
        class="form-select"
        style="width: auto; min-width: 140px; flex-shrink: 0;"
        value={row.fieldId}
        onchange={(e) => updateRow(row.localId, { fieldId: e.target.value })}
      >
        <option value="">{t("filters.choose", { fallback: "Choose..." })}</option>
        {#each fields as field (field.id)}
          <option value={String(field.id)}>{field.name?.content || field.name}</option>
        {/each}
      </select>
      <button
        type="button"
        class="btn btn-link text-decoration-none p-0 flex-shrink-0"
        aria-label={t("filters.remove-row", { fallback: "Remove search" })}
        onclick={() => removeRow(row.localId)}
      >
        <IconCircleX />
      </button>
    </div>
  {/each}

  <button
    type="button"
    class="btn btn-link text-decoration-none p-0 align-self-start"
    disabled={!canAddRow}
    onclick={addRow}
  >
    <IconCirclePlus size="16" />
    {t("filters.add-row", { fallback: "Add new search" })}
  </button>
</div>
