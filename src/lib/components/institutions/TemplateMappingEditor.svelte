<script>
  import { watch } from "runed";
  import SetMatch from "$lib/components/import/matchPreview/SetMatch.svelte";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconPlus, IconArrowRight, IconMinus, IconX } from "@tabler/icons-svelte";

  let { rows = $bindable([]), ontologyFields = [], canEdit = false } = $props();

  const { t } = getTranslationStore();

  const EMPTY_FIELD_LABEL = t("common.institution-field");

  const allOntologyFields = $derived(
    ontologyFields?.result || ontologyFields || page.data.ontologyFields?.result || []
  );

  const ontologyLabelById = $derived.by(() => {
    const map = new Map();
    for (const f of allOntologyFields || []) {
      if (!f?.id) continue;
      const label = f?.name?.content;
      if (typeof label === "string" && label.trim()) {
        map.set(f.id, label);
      }
    }
    return map;
  });

  function ontologyName(fieldId) {
    if (!fieldId) return "";
    return ontologyLabelById.get(fieldId) || "";
  }

  function isObjectIdField(fieldId) {
    if (!fieldId) return false;
    return (ontologyLabelById.get(fieldId) || "").toLowerCase() === "object id";
  }

  function rowHasObjectIdField(row) {
    return row.mappedFields.some(fieldId => isObjectIdField(fieldId));
  }

  function setPrimary(rowId) {
    rows = rows.map((r) => ({ ...r, primary: r.rowId === rowId }));
  }

  function addRow() {
    rows = [
      ...rows,
      { rowId: crypto.randomUUID(), institutionField: "", mappedFields: [], primary: rows.length === 0 },
    ];
  }

  function removeRow(rowId) {
    const next = rows.filter((r) => r.rowId !== rowId);
    const removedWasPrimary = rows.find((r) => r.rowId === rowId)?.primary;
    rows = next;
    if (removedWasPrimary && rows.length) {
      rows = rows.map((r, idx) => ({ ...r, primary: idx === 0 }));
    }
  }

  function addMappedField(rowId, fieldId) {
    if (!fieldId) return;
    rows = rows.map((r) => {
      if (r.rowId !== rowId || r.mappedFields.includes(fieldId)) return r;
      return { ...r, mappedFields: [...r.mappedFields, fieldId] };
    });
  }

  function removeMappedField(rowId, fieldId) {
    rows = rows.map((r) =>
      r.rowId === rowId ? { ...r, mappedFields: r.mappedFields.filter((id) => id !== fieldId) } : r
    );
  }

  // Picker modal: fetch AI suggestions for the selected institution field,
  // then let the user pick an ontology field to map to.
  let pickerOpen = $state(false);
  let pickerRowId = $state(null);
  let pickerFieldName = $state("");
  let pickerSuggestions = $state([]);
  let pickerMatched = $state(null);

  function openPicker(row) {
    pickerRowId = row.rowId;
    pickerFieldName = (row.institutionField || "").trim() || EMPTY_FIELD_LABEL;
    pickerSuggestions = [];
    pickerMatched = null;
    pickerOpen = true;
  }

  watch(
    () => pickerOpen,
    async (isOpen) => {
      if (!isOpen) return;
      const raw = (pickerFieldName || "").trim();
      if (!raw || raw === EMPTY_FIELD_LABEL) {
        pickerSuggestions = [];
        return;
      }
      try {
        const res = await window.api.suggestFieldMappings([raw], { maxSuggestions: 3, threshold: 0.2 });
        pickerSuggestions = res?.[0]?.suggestions || [];
      } catch (err) {
        console.warn("Failed to load mapping suggestions:", err);
        pickerSuggestions = [];
      }
    }
  );

  watch(
    () => pickerMatched,
    (matched) => {
      if (!matched?.id || !pickerRowId) return;
      addMappedField(pickerRowId, matched.id);
    }
  );
</script>

<table class="table table-sm align-middle">
  <thead>
    <tr>
      <th style="width: 60px;">{t("common.id")}</th>
      <th>{t("common.institution-field")}</th>
      <th>{t("common.project-field")}</th>
      <th style="width: 36px;"></th>
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.rowId)}
      <tr>
        <td class="text-center">
          <BaseTooltip rootProps={{ side: "right", align: "center" }}>
            {#snippet trigger(props)}
              <span class="d-inline-flex" {...(({ type, ...rest }) => rest)(props)}>
                <input
                  type="checkbox"
                  class="form-check-input"
                  checked={row.primary}
                  onchange={() => setPrimary(row.rowId)}
                  disabled={!canEdit || row.primary}
                />
              </span>
            {/snippet}
            {t("common.primary-id-tooltip")}
          </BaseTooltip>
        </td>
        <td>
          <input
            class="form-control form-control-sm"
            placeholder=""
            bind:value={row.institutionField}
            disabled={!canEdit}
          />
        </td>
        <td>
          <div class="d-flex align-items-center gap-2 flex-wrap">
            <IconArrowRight size={16} class="text-muted" />

            {#each row.mappedFields as fieldId (fieldId)}
              <span class="badge text-bg-light border d-inline-flex align-items-center gap-1">
                {ontologyName(fieldId) || fieldId}
                <button
                  type="button"
                  class="btn btn-sm border-0 p-0"
                  onclick={() => removeMappedField(row.rowId, fieldId)}
                  disabled={!canEdit}
                  aria-label={t("common.remove-mapping")}
                >
                  <IconX size={16} />
                </button>
              </span>
            {/each}

            <button
              type="button"
              class="btn btn-secondary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0"
              onclick={() => openPicker(row)}
              disabled={!canEdit}
              aria-label={t("common.add-mapped-field")}
            >
                <IconPlus size={16} />
            </button>
          </div>
        </td>
        <td class="text-end">
          {#if rowHasObjectIdField(row)}
            <BaseTooltip rootProps={{ side: "left", align: "start" }}>
              {#snippet trigger(props)}
                <div {...(({ type, ...rest }) => rest)(props)}>
                  <button
                    type="button"
                    class="btn btn-danger rounded-circle d-flex align-items-center justify-content-center p-0"
                    onclick={() => removeRow(row.rowId)}
                    disabled={true}
                    aria-label={t("common.delete-row")}
                  >
                    <IconMinus size={16} />
                  </button>
                </div>
              {/snippet}
              {t("common.object-id-field-cannot-be-deleted")}
            </BaseTooltip>
          {:else}
            <button
              type="button"
              class="btn btn-danger rounded-circle d-flex align-items-center justify-content-center p-0"
              onclick={() => removeRow(row.rowId)}
              disabled={!canEdit}
              aria-label={t("common.delete-row")}
            >
              <IconMinus size={16} />
            </button>
          {/if}
        </td>
      </tr>
    {/each}

    <tr>
      <td colspan="4">
        <button
          type="button"
          class="btn btn-link text-success p-0 d-flex align-items-center gap-1"
          onclick={addRow}
          disabled={!canEdit}
        >
          <IconPlus size={16} class="me-1" />
          {t("export.add-field")}
        </button>
      </td>
    </tr>
  </tbody>
</table>

<SetMatch
  field={pickerFieldName}
  suggestions={pickerSuggestions}
  bind:fieldMatched={pickerMatched}
  bind:open={pickerOpen}
  triggerVariant="add"
  buttonProps={{ class: "d-none" }}
/>
