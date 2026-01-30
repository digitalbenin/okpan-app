<script>
  import { watch } from "runed";
  import SetMatch from "$lib/components/import/matchPreview/SetMatch.svelte";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import { createTemplate, updateTemplate, updateTemplateAndPropagate } from "$lib/stores/TemplatesUtils.js";
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { institution, mappingTemplates = [], ontologyFields = [] } = $props();

  const { t } = getTranslationStore();

  const projectId = $derived(institution?.project_id);
  const institutionId = $derived(institution?.id);

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

  function safeParseMapping(raw) {
    if (!raw) return [];
    const norm = (e) => {
      if (!e) return null;
      if (typeof e === "string") {
        try {
          return JSON.parse(e);
        } catch {
          return null;
        }
      }
      return typeof e === "object" ? e : null;
    };
    if (Array.isArray(raw)) return raw.map(norm).filter(Boolean);
    if (typeof raw !== "string") return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(norm).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function titleForTemplate(tpl, idx) {
    const title = tpl?.name;
    if (typeof title === "string" && title.trim()) return title.trim();
    return `Template ${idx + 1}`;
  }

  function ontologyName(fieldId) {
    if (!fieldId) return "";
    return ontologyLabelById.get(fieldId) || "";
  }

  function isObjectIdField(fieldId) {
    if (!fieldId) return false;
    const name = ontologyLabelById.get(fieldId) || "";
    return name.toLowerCase() === "object id";
  }

  function rowHasObjectIdField(row) {
    return row.mappedFields.some(fieldId => isObjectIdField(fieldId));
  }

  function coercePrimaryBool(val) {
    return val === true || val === 1 || val === "1" || val === "true";
  }

  // Option B storage: [{ headerField, mappedField, primary: 0|1 }, ...]
  // UI groups by headerField to support multi-mapping in a single row.
  function groupTemplateMappingToRows(entries) {
    const groups = new Map();
    const ordered = [];

    for (const entry of entries || []) {
      if (!entry) continue;
      const headerField = typeof entry.headerField === "string" ? entry.headerField.trim() : "";
      if (!headerField) continue;

      let group = groups.get(headerField);
      if (!group) {
        group = {
          rowId: crypto.randomUUID(),
          institutionField: headerField,
          mappedFields: [],
          primary: false,
        };
        groups.set(headerField, group);
        ordered.push(group);
      }

      group.primary = group.primary || coercePrimaryBool(entry.primary);

      const ids = Array.isArray(entry?.mappedFields)
        ? entry.mappedFields.filter(Boolean)
        : entry?.mappedField != null
          ? [entry.mappedField]
          : [];

      for (const id of ids) {
        if (!group.mappedFields.includes(id)) group.mappedFields = [...group.mappedFields, id];
      }
    }

    return ordered;
  }

  let templates = $state(mappingTemplates || []);
  let selectedTemplateId = $state(null);

  const EMPTY_FIELD_LABEL = "(Field)";

  let templateTitle = $state("");
  let rows = $state([]);

  function initEditorState() {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    const idx = tpl ? templates.findIndex((t) => t.id === tpl.id) : 0;
    templateTitle = tpl ? titleForTemplate(tpl, Math.max(0, idx)) : "";

    let nextRows = groupTemplateMappingToRows(safeParseMapping(tpl?.mapping));
    if (!nextRows.length) {
      nextRows = [
        {
          rowId: crypto.randomUUID(),
          institutionField: "",
          mappedFields: [],
          primary: true,
        },
      ];
    }

    const firstPrimary = nextRows.findIndex((r) => r.primary);
    if (firstPrimary !== -1) {
      nextRows = nextRows.map((r, i) => ({ ...r, primary: i === firstPrimary }));
    }
    rows = nextRows;
  }

  watch(
    [() => mappingTemplates, () => selectedTemplateId],
    ([nextTemplates, _nextSelectedId], [prevTemplates, prevSelectedId]) => {
      if (nextTemplates !== prevTemplates) {
        templates = Array.isArray(nextTemplates) ? nextTemplates : [];
      }

      // Keep selection valid when templates change
      if (!templates.length) {
        selectedTemplateId = null;
      } else if (!selectedTemplateId || !templates.some((t) => t.id === selectedTemplateId)) {
        selectedTemplateId = templates[0].id;
      }

      // Initialize editor state when selection OR templates change
      const shouldInit = selectedTemplateId !== prevSelectedId || nextTemplates !== prevTemplates;
      if (shouldInit) {
        initEditorState();
      }
    }
  );

  const canEdit = $derived(Boolean(selectedTemplateId));

  function setPrimary(rowId) {
    rows = rows.map((r) => ({ ...r, primary: r.rowId === rowId }));
  }

  function addRow() {
    rows = [
      ...rows,
      {
        rowId: crypto.randomUUID(),
        institutionField: "",
        mappedFields: [],
        primary: rows.length === 0,
      },
    ];
  }

  function removeRow(rowId) {
    const next = rows.filter((r) => r.rowId !== rowId);
    const hadPrimary = rows.find((r) => r.rowId === rowId)?.primary;
    rows = next;
    if (hadPrimary && rows.length) {
      rows = rows.map((r, idx) => ({ ...r, primary: idx === 0 }));
    }
  }

  function removeMappedField(rowId, fieldId) {
    rows = rows.map((r) =>
      r.rowId === rowId
        ? { ...r, mappedFields: r.mappedFields.filter((id) => id !== fieldId) }
        : r
    );
  }

  function addMappedField(rowId, fieldId) {
    if (!fieldId) return;
    rows = rows.map((r) => {
      if (r.rowId !== rowId) return r;
      if (r.mappedFields.includes(fieldId)) return r;
      return { ...r, mappedFields: [...r.mappedFields, fieldId] };
    });
  }

  const mappingPayload = $derived.by(() => {
    const cleaned = rows
      .map((r) => {
        const headerField = (r.institutionField || "").trim();
        if (!headerField) return null;
        const mappedFields = (r.mappedFields || []).filter(Boolean);
        return {
          headerField,
          mappedFields,
          primary: Boolean(r.primary),
        };
      })
      .filter(Boolean);

    if (!cleaned.length) return [];

    // Ensure exactly one primary header field row
    const primaryRowIndex = Math.max(0, cleaned.findIndex((r) => r.primary));

    const expanded = [];
    for (let i = 0; i < cleaned.length; i++) {
      const r = cleaned[i];
      const primary01 = i === primaryRowIndex ? 1 : 0;
      if (!r.mappedFields.length) {
        expanded.push({ headerField: r.headerField, mappedField: null, primary: primary01 });
      } else {
        for (const id of r.mappedFields) {
          expanded.push({ headerField: r.headerField, mappedField: id, primary: primary01 });
        }
      }
    }

    return expanded;
  });

  let saving = $state(false);
  let creating = $state(false);

  async function onAddTemplate() {
    if (!projectId || !institutionId || creating) return;
    creating = true;
    try {
      const nextTitle = `Template ${templates.length + 1}`;
      const res = await createTemplate({
        mapping: [],
        projectId,
        institutionId,
        title: nextTitle,
      });
      const created = res?.result?.insertIntoTemplates?.[0] || res?.result?.[0];
      if (created?.id) {
        templates = [...templates, created];
        selectedTemplateId = created.id;
      }
    } catch (err) {
      console.error("Failed to create template:", err);
    } finally {
      creating = false;
    }
  }

  async function onSaveTemplate() {
    if (!selectedTemplateId || saving) return;
    saving = true;
    try {
      // Use the new mutation that propagates changes to all affected objects
      const res = await updateTemplateAndPropagate(selectedTemplateId, {
        mapping: mappingPayload,
        institutionId,
        title: (templateTitle || "").trim() || null,
      });
      
      const updated = res?.result?.updatedTemplate || null;
      const affectedObjects = res?.result?.affectedObjects || 0;
      const updatedFields = res?.result?.updatedFields || 0;
      
      if (updated?.id) {
        templates = templates.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
        
        // Show feedback to user
        if (affectedObjects > 0 || updatedFields > 0) {
          console.log(`Template saved and propagated to ${affectedObjects} objects (${updatedFields} fields updated)`);
        } else {
          console.log('Template saved (no objects affected)');
        }
      } else {
        // optimistic update fallback
        templates = templates.map((t) =>
          t.id === selectedTemplateId
            ? { ...t, mapping: mappingPayload, name: (templateTitle || "").trim() }
            : t
        );
      }
    } catch (err) {
      console.error("Failed to save template:", err);
    } finally {
      saving = false;
    }
  }

  // Reusable picker modal state (suggestions shown ONLY inside the modal)
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
    async (nextOpen) => {
      if (!nextOpen) return;
      const raw = (pickerFieldName || "").trim();
      if (!raw || raw === EMPTY_FIELD_LABEL) {
        pickerSuggestions = [];
        return;
      }
      try {
        const res = await window.api.suggestFieldMappings([raw], {
          maxSuggestions: 3,
          threshold: 0.2,
        });
        pickerSuggestions = res?.[0]?.suggestions || [];
      } catch (err) {
        console.warn("Failed to load mapping suggestions:", err);
        pickerSuggestions = [];
      }
    }
  );

  watch(
    () => pickerMatched,
    (nextMatched) => {
      if (!nextMatched?.id || !pickerRowId) return;
      addMappedField(pickerRowId, nextMatched.id);
    }
  );
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col-12 d-flex justify-content-end mb-2">
      <button
        class="btn btn-secondary btn-sm"
        onclick={onAddTemplate}
        disabled={creating || !projectId || !institutionId}
      >
      <i class="bi bi-plus"></i>
        {t("common.add-template", { fallback: "Add template" })}
      </button>
    </div>
  </div>

  <div class="row">
    <!-- Left: template list -->
    <div class="col-2">
      <div class="text-muted mb-2">
        {t("common.mapping-templates", { fallback: "Mapping templates" })}
      </div>

      <div class="list-group">
        {#if templates.length === 0}
          <div class="list-group-item text-muted fst-italic">
            {t("common.no-templates", { fallback: "No templates" })}
          </div>
        {:else}
          {#each templates as tpl, idx (tpl.id)}
            <button
              type="button"
              class="list-group-item list-group-item-action border-0 text-truncate"
              class:bg-light={tpl.id === selectedTemplateId}
              onclick={() => (selectedTemplateId = tpl.id)}
            >
              {titleForTemplate(tpl, idx)}
            </button>
          {/each}
        {/if}
      </div>
    </div>

    <!-- Right: template editor -->
    <div class="col-10">
      <div class="card border-0">
        <div class="card-body">
          <div class="mb-4">
            <h5 class="mb-3">
              {t("common.template-info", { fallback: "Template info" })}
            </h5>

            <label class="form-label text-muted" for="template-title">
              {t("common.data-mapping-title", {
                fallback: "Data mapping title",
              })}
            </label>
            <input
              id="template-title"
              class="form-control"
              placeholder={t("common.template-title-placeholder", {
                fallback: "Template 1",
              })}
              bind:value={templateTitle}
              disabled={!canEdit}
            />
          </div>

          <div>
            <h5 class="mb-3">
              {t("common.template-mapping", { fallback: "Template mapping" })}
            </h5>

            <table class="table table-sm align-middle">
              <thead>
                <tr>
                  <th style="width: 60px;">Id</th>
                  <th>Institution field</th>
                  <th>Project field</th>
                  <th style="width: 36px;"></th>
                </tr>
              </thead>
              <tbody>
                {#each rows as row (row.rowId)}
                  <tr>
                    <td class="text-center">
                      <input
                        type="checkbox"
                        class="form-check-input"
                        checked={row.primary}
                        onchange={() => setPrimary(row.rowId)}
                        disabled={!canEdit}
                      />
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
                        <i class="bi bi-arrow-right text-muted"></i>

                        {#each row.mappedFields as fieldId (fieldId)}
                          <span
                            class="badge text-bg-light border d-inline-flex align-items-center gap-1"
                          >
                            {ontologyName(fieldId) || fieldId}
                            <button
                              type="button"
                              class="btn btn-sm border-0 p-0"
                              onclick={() => removeMappedField(row.rowId, fieldId)}
                              disabled={!canEdit}
                              aria-label="Remove mapping"
                            >
                              <i class="bi bi-x"></i>
                            </button>
                          </span>
                        {/each}

                        <button
                          type="button"
                          class="btn btn-secondary btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 px-1"
                          onclick={() => openPicker(row)}
                          disabled={!canEdit}
                          aria-label="Add mapped field"
                        >
                          <i class="bi bi-plus"></i>
                        </button>
                      </div>
                    </td>
                    <td class="text-end">
                      {#if rowHasObjectIdField(row)}
                        <BaseTooltip rootProps={{ side: "left", align: "start" }}>
                          {#snippet trigger(props)}
                            <div class="d-inline-block" {...(({ type, ...rest }) => rest)(props)}>
                              <button
                                type="button"
                                class="btn btn-link text-danger p-0"
                                onclick={() => removeRow(row.rowId)}
                                disabled={true}
                                aria-label="Delete row"
                              >
                                <i class="bi bi-dash-circle-fill"></i>
                              </button>
                            </div>
                          {/snippet}
                          {t("common.object-id-field-cannot-be-deleted", {
                            fallback: "Cannot delete: mapped to Object ID field"
                          })}
                        </BaseTooltip>
                      {:else}
                        <button
                          type="button"
                          class="btn btn-link text-danger p-0"
                          onclick={() => removeRow(row.rowId)}
                          disabled={!canEdit}
                          aria-label="Delete row"
                        >
                          <i class="bi bi-dash-circle-fill"></i>
                        </button>
                      {/if}
                    </td>
                  </tr>
                {/each}

                <tr>
                  <td colspan="4">
                    <button
                      type="button"
                      class="btn btn-link text-success p-0"
                      onclick={addRow}
                      disabled={!canEdit}
                    >
                      <i class="bi bi-plus-circle me-1"></i>
                      {t("common.add-field", { fallback: "Add field" })}
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card-footer bg-transparent border-0 d-flex justify-content-end">
          <button
            class="btn btn-success"
            onclick={onSaveTemplate}
            disabled={!canEdit || saving}
          >
            {t("common.save-template", { fallback: "Save template" })}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Hidden-trigger reusable modal for ontology field selection -->
<SetMatch
  field={pickerFieldName}
  suggestions={pickerSuggestions}
  bind:fieldMatched={pickerMatched}
  bind:open={pickerOpen}
  triggerVariant="add"
  buttonProps={{ class: "d-none" }}
/>

