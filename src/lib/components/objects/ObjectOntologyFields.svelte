<script>
  import { Tabs } from "melt/builders";
  import { invalidate, goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseBadge from "$lib/components/base/BaseBadge.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { unlinkDatasourceFromObject } from "$lib/stores/DatasourcesUtils.js";
  import { epochToDate } from "$lib/utils/dates.js";

  const { object, datasources } = $props();
  const { t } = getTranslationStore();

  const ontologyFields = $derived(object?.objectsOntologyFields ?? []);
  const datasourcesMap = $derived.by(() => 
    new Map((datasources ?? []).map(ds => [ds.id, ds]))
  );

  const fieldsByDatasource = $derived.by(() => {
    const groups = new Map();
    for (const field of ontologyFields) {
      const id = field.datasources_id || "no-datasource";
      const datasource = datasourcesMap.get(id);
      
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          name: datasource?.name?.content ?? t("common.no-datasource", { fallback: "No Datasource" }),
          fields: [],
          datasource,
          objectCount: datasource?.objectsCount ?? 0
        });
      }
      groups.get(id).fields.push(field);
    }
    return Array.from(groups.values());
  });

  const tabs = new Tabs({ value: () => fieldsByDatasource[0]?.id ?? null });

  let expandedFields = $state(new Set());
  const needsTruncation = (text) => text?.length > 160;
  const toggleExpanded = (fieldId) => {
    expandedFields.has(fieldId) ? expandedFields.delete(fieldId) : expandedFields.add(fieldId);
    expandedFields = new Set(expandedFields);
  };
  const formatValue = (fieldId, text) => 
    !text ? "" : !needsTruncation(text) ? text : expandedFields.has(fieldId) ? text : `${text.substring(0, 160)}...`;

  const getFileExtension = (source) => source?.split(".").pop()?.toUpperCase() ?? null;

  let unlinkDialogOpen = $state(false);
  let unlinkTargetId = $state(null);
  let unlinking = $state(false);

  const unlinkTargetName = $derived(datasourcesMap.get(unlinkTargetId)?.name?.content ?? "");

  const handleUnlink = async () => {
    if (!unlinkTargetId || !object?.id || unlinking) return;
    
    unlinking = true;
    const { error } = await unlinkDatasourceFromObject(object.id, unlinkTargetId);
    unlinking = false;
    unlinkDialogOpen = false;
    unlinkTargetId = null;
    
    if (error) {
      console.error("Failed to unlink datasource:", error);
      return;
    }
    invalidate("custom:object");
  };

  const handleEdit = (datasourceId) => {
    const ds = datasourcesMap.get(datasourceId);
    const { project_id, institution_id } = { project_id: object?.project_id, institution_id: ds?.institution_id };
    
    if (!project_id || !institution_id) {
      console.error("Missing navigation data", { project_id, institution_id, datasourceId });
      return;
    }
    goto(`/projects/${project_id}/institutions/${institution_id}/datasources/${datasourceId}`);
  };
</script>

<div class="bg-white mb-2 px-2">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h3 class="mb-0">{t("objects.institution_data.title", { fallback: "Institution Data" })}</h3>
  </div>

  {#if fieldsByDatasource.length > 0}
    <ul class="nav nav-underline mb-3 border-bottom" {...tabs.triggerList}>
      {#each fieldsByDatasource as { id, name }}
        <li class="nav-item">
          <button {...tabs.getTrigger(id)} type="button" class="nav-link" class:active={id === tabs.value} role="tab" aria-selected={id === tabs.value}>
            {name}
          </button>
        </li>
      {/each}
    </ul>

    {#each fieldsByDatasource as { id, datasource, objectCount, fields }}
      <div {...tabs.getContent(id)}>
        {#if datasource}
          <div class="mb-3">
            <div class="row g-3 mb-3">
              <div class="col-auto">
                <div class="text-uppercase small text-muted mb-1">{t("common.file-format", { fallback: "File format" })}</div>
                <div class="fw-medium">{getFileExtension(datasource.source) ?? "N/A"}</div>
              </div>
              <div class="col-auto">
                <div class="text-uppercase small text-muted mb-1">{t("common.import-date", { fallback: "Import date" })}</div>
                <div class="fw-medium">{epochToDate(datasource.date, false) ?? "Invalid Date"}</div>
              </div>
              <div class="col-auto">
                <div class="text-uppercase small text-muted mb-1">{t("common.imported-objects", { fallback: "Imported objects" })}</div>
                <div class="fw-medium">{objectCount} {t("common.objects", { fallback: "objects" })}</div>
              </div>
            </div>

            <div class="d-flex gap-2">
              <BaseButton class="btn btn-sm btn-outline-secondary" icon="link-45deg" 
                text={t("common.unlink", { fallback: "Unlink" })} 
                disabled={unlinkTargetId === id && (unlinkDialogOpen || unlinking)}
                onClick={() => { unlinkTargetId = id; unlinkDialogOpen = true; }} />
              <BaseButton class="btn btn-sm btn-outline-secondary" icon="pencil" 
                text={t("common.edit-data-source", { fallback: "Edit Data Source" })} 
                onClick={() => handleEdit(id)} />
            </div>
          </div>
        {/if}

        {#if fields.length > 0}
          <table class="table table-borderless">
            <thead>
              <tr class="border-bottom">
                <th scope="col" class="fw-normal text-muted">Institution field</th>
                <th scope="col" class="fw-normal text-muted">Linked field</th>
                <th scope="col" class="fw-normal text-muted">Value</th>
              </tr>
            </thead>
            <tbody>
              {#each fields as field (field.id)}
                <tr class="border-bottom">
                  <td class="align-middle">{field.label ?? "Untitled Field"}</td>
                  <td class="align-middle">
                    <div class="d-flex align-items-center">
                      <span class="text-muted me-2">Matched to</span>
                      <i class="bi bi-arrow-right text-muted me-2"></i>
                      <BaseBadge value={field.ontologyField?.name?.content ?? field.label ?? "Unknown"} 
                        class="bg-secondary-subtle text-dark" />
                    </div>
                  </td>
                  <td class="align-middle">
                    {#if field.value}
                      <span>{formatValue(field.id, field.value)}</span>
                      {#if needsTruncation(field.value)}
                        <button type="button" class="btn btn-link btn-sm p-0 ms-2 text-decoration-none" onclick={() => toggleExpanded(field.id)}>
                          {expandedFields.has(field.id) ? "read less" : "read more"}
                        </button>
                      {/if}
                    {:else}
                      <span class="text-muted fst-italic">Value field</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="text-center text-muted py-4">No ontology fields for this datasource</div>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="text-center text-muted py-4">
      <i class="bi bi-database fs-1 opacity-50"></i>
      <div class="mt-2">{t("objects.no-institution-data-found", { fallback: "No institution data found for this object" })}</div>
    </div>
  {/if}
</div>

<BaseAlertDialog bind:open={unlinkDialogOpen}>
  {#snippet title()}{t("objects.unlink-datasource.title", { fallback: "Unlink data source" })}{/snippet}
  {#snippet description()}
    <p>{t("objects.unlink-datasource.confirm", { fallback: "Are you sure you want to unlink this data source from the object?" })}</p>
    {#if unlinkTargetName}<p class="fw-medium mb-2">{unlinkTargetName}</p>{/if}
    <p class="text-muted small mb-0">{t("objects.unlink-datasource.impact", { fallback: "This removes all institution fields linked to this data source for the current object." })}</p>
  {/snippet}
  {#snippet footer()}
    <button class="btn btn-outline-secondary" onclick={() => { if (!unlinking) { unlinkDialogOpen = false; unlinkTargetId = null; }}} disabled={unlinking}>
      {t("common.cancel", { fallback: "Cancel" })}
    </button>
    <button class="btn btn-danger" onclick={handleUnlink} disabled={unlinking}>
      {unlinking ? t("common.processing", { fallback: "Processing..." }) : t("common.unlink", { fallback: "Unlink" })}
    </button>
  {/snippet}
</BaseAlertDialog>

<style>
  [data-melt-tabs-trigger] {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem 0.25rem 0 0;
    cursor: pointer;
    border-bottom: 1px solid transparent;
    margin-bottom: -1px;
  }
  [data-melt-tabs-trigger][data-state="active"] {
    border: 1px solid #dee2e6;
    border-bottom-color: white;
    background-color: white;
    color: var(--bs-nav-tabs-link-active-color, #495057);
  }
  [data-melt-tabs-trigger]:not([data-state="active"]) {
    color: var(--bs-nav-link-color, #0d6efd);
  }
  [data-melt-tabs-trigger]:hover:not([data-state="active"]) {
    border-color: var(--bs-border-color-translucent, #dee2e6);
    color: var(--bs-nav-link-hover-color, #0a58ca);
  }
  [data-melt-tabs-content] { padding: 1rem 0; }
  .nav-tabs { display: flex; border-bottom: 1px solid #dee2e6; gap: 0.5rem; margin-bottom: 1rem; }
  :global(.nav-underline .nav-link.active), :global(.nav-underline .show > .nav-link) { font-weight: 400 !important; }
</style>
