<script>
  import { watch } from "runed";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import TemplateMappingEditor from "$lib/components/institutions/TemplateMappingEditor.svelte";
  import { createTemplate, updateTemplateAndPropagate, deleteTemplateAndCleanup, countObjectsUsingTemplate } from "$lib/api/TemplatesApi.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconDeviceFloppy, IconTrash, IconCirclePlus, IconMinus } from "@tabler/icons-svelte";

  let { institution, mappingTemplates = [], ontologyFields = [] } = $props();

  const { t } = getTranslationStore();

  const projectId = $derived(institution?.project_id);
  const institutionId = $derived(institution?.id);

  function titleForTemplate(tpl, idx) {
    const title = tpl?.name;
    if (typeof title === "string" && title.trim()) return title.trim();
    return `Template ${idx + 1}`;
  }

  function coercePrimaryBool(val) {
    return val === true || val === 1 || val === "1" || val === "true";
  }

  function safeParseMapping(raw) {
    if (!raw) return [];
    const norm = (e) => {
      if (!e) return null;
      if (typeof e === "string") {
        try { return JSON.parse(e); } catch { return null; }
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
        group = { rowId: crypto.randomUUID(), institutionField: headerField, mappedFields: [], primary: false };
        groups.set(headerField, group);
        ordered.push(group);
      }

      group.primary = group.primary || coercePrimaryBool(entry.primary);

      const ids = Array.isArray(entry?.mappedFields)
        ? entry.mappedFields.filter(Boolean)
        : entry?.mappedField != null ? [entry.mappedField] : [];

      for (const id of ids) {
        if (!group.mappedFields.includes(id)) group.mappedFields = [...group.mappedFields, id];
      }
    }

    return ordered;
  }

  let templates = $state(mappingTemplates || []);
  let selectedTemplateId = $state(null);
  let templateTitle = $state("");
  let rows = $state([]);

  function initEditorState() {
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    const idx = tpl ? templates.findIndex((t) => t.id === tpl.id) : 0;
    templateTitle = tpl ? titleForTemplate(tpl, Math.max(0, idx)) : "";

    let nextRows = groupTemplateMappingToRows(safeParseMapping(tpl?.mapping));
    if (!nextRows.length) {
      nextRows = [{ rowId: crypto.randomUUID(), institutionField: "", mappedFields: [], primary: true }];
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

      if (selectedTemplateId !== prevSelectedId || nextTemplates !== prevTemplates) {
        initEditorState();
      }
    }
  );

  const canEdit = $derived(Boolean(selectedTemplateId));

  // Serialize rows into the flat Option B format expected by the backend.
  const mappingPayload = $derived.by(() => {
    const cleaned = rows
      .map((r) => {
        const headerField = (r.institutionField || "").trim();
        if (!headerField) return null;
        return {
          headerField,
          mappedFields: (r.mappedFields || []).filter(Boolean),
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
      const res = await createTemplate({
        mapping: [],
        projectId,
        institutionId,
        title: `Template ${templates.length + 1}`,
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
      const res = await updateTemplateAndPropagate(selectedTemplateId, {
        mapping: mappingPayload,
        institutionId,
        title: (templateTitle || "").trim() || null,
      });
      const updated = res?.result?.updatedTemplate || null;
      if (updated?.id) {
        templates = templates.map((t) => (t.id === updated.id ? { ...t, ...updated } : t));
      } else {
        // Optimistic update fallback
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

  let deleteModalOpen = $state(false);
  let deletingTemplate = $state(false);
  let objectCountUsingTemplate = $state(0);

  async function promptDeleteTemplate() {
    if (!selectedTemplateId) return;
    try {
      const objectRows = await countObjectsUsingTemplate(selectedTemplateId);
      objectCountUsingTemplate = new Set((objectRows || []).map((o) => o.object_id)).size;
    } catch (err) {
      console.error("Failed to count template usage:", err);
      objectCountUsingTemplate = 0;
    }
    deleteModalOpen = true;
  }

  async function onDeleteTemplate() {
    if (!selectedTemplateId || deletingTemplate) return;
    deletingTemplate = true;
    try {
      await deleteTemplateAndCleanup(selectedTemplateId);
      templates = templates.filter((t) => t.id !== selectedTemplateId);
      selectedTemplateId = templates.length > 0 ? templates[0].id : null;
      deleteModalOpen = false;
    } catch (err) {
      console.error("Failed to delete template:", err);
    } finally {
      deletingTemplate = false;
    }
  }
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col-12 d-flex justify-content-end mb-2">
      <button
        class="btn btn-primary btn-sm"
        onclick={onAddTemplate}
        disabled={creating || !projectId || !institutionId}
      >
        <IconCirclePlus size={16} />
        {t("common.add-template")}
      </button>
    </div>
  </div>

  <div class="row">
    <!-- Left: template list -->
    <div class="col-2 border-end border-1 border-dark-subtle pe-3">
      <div class="text-muted mb-2">
        {t("common.mapping-templates")}
      </div>

      <div class="list-group">
        {#if templates.length === 0}
          <div class="list-group-item text-muted fst-italic">
            {t("common.no-templates")}
          </div>
        {:else}
          {#each templates as tpl, idx (tpl.id)}
            <button
              type="button"
              class="list-group-item list-group-item-action rounded-0 border-0 text-truncate"
              class:bg-gray-200={tpl.id === selectedTemplateId}
              class:border-start={tpl.id === selectedTemplateId}
              class:border-3={tpl.id === selectedTemplateId}
              class:border-primary={tpl.id === selectedTemplateId}
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
              {t("common.template-info")}
            </h5>

            <label class="form-label text-muted" for="template-title">
              {t("common.data-mapping-title")}
            </label>
            <input
              id="template-title"
              class="form-control"
              placeholder={t("common.template-title-placeholder")}
              bind:value={templateTitle}
              disabled={!canEdit}
            />
          </div>

          <div>
            <h5 class="mb-3">
              {t("common.template-mapping")}
            </h5>
            <TemplateMappingEditor bind:rows {ontologyFields} {canEdit} />
          </div>
        </div>

        <div class="card-footer bg-transparent border-0 d-flex justify-content-between gap-2">
          <button
            class="btn btn-outline-danger"
            onclick={promptDeleteTemplate}
            disabled={!canEdit || saving || creating || deletingTemplate}
          >
            <IconTrash size={16} />
             {t("common.delete-template")}
          </button>

          <button
            class="btn btn-success"
            onclick={onSaveTemplate}
            disabled={!canEdit || saving || creating || deletingTemplate}
          > 
            <IconDeviceFloppy size={16} />
            {t("common.save-template")}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>


<BaseModal bind:isOpen={deleteModalOpen}>
  {#snippet header()}
    {t("common.delete-template-confirm-title", { fallback: "Confirm deletion" })}
  {/snippet}
  {#snippet body()}
    {#if objectCountUsingTemplate > 0}
      <p class="mb-3">
        {#if objectCountUsingTemplate === 1}
          {t("common.template-used-by-one-object", { fallback: "This template is currently used by 1 object. Deleting it will also delete the mapped field values for that object." })}
        {:else}
          {objectCountUsingTemplate} {t("common.template-used-by-many-objects", { fallback: "objects currently use this template. Deleting it will also delete the mapped field values for those objects." })}
        {/if}
      </p>
    {/if}
    <p class="mb-0">
      {t("common.delete-template-confirm-msg", { fallback: "Are you sure you want to delete this template? This cannot be undone." })}
    </p>
  {/snippet}
  {#snippet actions()}
    <BaseButton
      text={t("common.cancel", { fallback: "Cancel" })}
      class="btn btn-secondary"
      onClick={() => (deleteModalOpen = false)}
    />
    <BaseButton 
      text={t("common.delete", { fallback: "Delete" })} 
      class="btn btn-danger" 
      onClick={onDeleteTemplate} 
      loading={deletingTemplate} 
    />
  {/snippet}
</BaseModal>