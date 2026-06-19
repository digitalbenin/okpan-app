<script>
  import { invalidate, invalidateAll } from "$app/navigation";
  import { tick } from "svelte";
  import { watch } from "runed";
  import ObjectInstitutionalDataSource from "./ObjectInstitutionalDataSource.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import DatasourceEditForm from "$lib/components/datasources/DatasourceEditForm.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { epochToDate } from "$lib/utils/dates.js";
  import {
    createDatasource,
    deleteDatasourceFromObject,
    saveOntologyFieldsForDatasource,
  } from "$lib/api/DatasourcesApi.js";

  const {
    object,
    datasources = [],
    templates = [],
    ontologyFields = [],
    projectId,
    institutionId,
    defaultLanguageId,
    languages = [],
    onChangesUpdate = null,
  } = $props();

  const { t } = getTranslationStore();

  let localDatasources = $state([]);

  const datasourcesArray = $derived(
    [...datasources, ...localDatasources.filter(local => !datasources.some(d => d.id === local.id))]
      .sort((a, b) => (Number(a.date) || 0) - (Number(b.date) || 0))
  );
  
  let creating = $state(false);
  let componentChanges = $state(new Map());
  let lastNotifiedHasChanges = null;
  let activeDatasourceId = $state(null);
  let tabsContainer = $state(null);
  let deleteDialogOpen = $state(false);
  let datasourceToDeleteId = $state(null);
  let deleting = $state(false);

  // Edit modal state
  let editModalOpen = $state(false);
  let datasourceToEdit = $state(null);
  let editForm = $state(null);

  const handleEditSuccess = () => {
      editModalOpen = false;
      datasourceToEdit = null;
      invalidate("custom:object");
  };

  // Keep the active tab valid whenever the datasource list changes
  watch(() => datasourcesArray, (dsArray) => {
    if (dsArray.length > 0 && !dsArray.some(d => d.id === activeDatasourceId)) {
      activeDatasourceId = dsArray[0].id;
    }
  });

  // Build maps for datasource templates and fields
  const datasourceTemplateMap = $derived.by(() => {
    const map = new Map();
    (object?.objectsDatasources || []).forEach(od => {
      if (od.datasource_id && od.template) map.set(od.datasource_id, od.template);
    });
    return map;
  });

  const datasourceFieldsMap = $derived.by(() => {
    const map = new Map();
    (object?.objectsOntologyFields || []).forEach(field => {
      if (field.datasources_id) {
        if (!map.has(field.datasources_id)) map.set(field.datasources_id, []);
        map.get(field.datasources_id).push(field);
      }
    });
    return map;
  });

  // Track changes from child components
  const handleComponentChanges = (changeData) => {
    const previousChange = componentChanges.get(changeData.component);
    if (previousChange?.hasChanges === changeData.hasChanges) {
      return;
    }

    componentChanges.set(changeData.component, changeData);
    componentChanges = new Map(componentChanges);
    
    // Notify parent if callback provided – skip if aggregate hasn't changed
    if (onChangesUpdate) {
      const hasAnyChanges = Array.from(componentChanges.values()).some(c => c.hasChanges);
      if (hasAnyChanges === lastNotifiedHasChanges) return;
      lastNotifiedHasChanges = hasAnyChanges;
      
      onChangesUpdate({
        component: "institutional-data",
        hasChanges: hasAnyChanges,
        saveFunction: async (targetObjectId) => {
          const objectId = targetObjectId || object?.id;
          if (!objectId) {
            throw new Error("Missing object ID for institutional data save");
          }

          const saves = Array.from(componentChanges.values())
            .filter(c => c.hasChanges && c.getData)
            .map(c => c.getData())
            .map(data => saveOntologyFieldsForDatasource(
              objectId, data.datasourceId, data.templateId, data.fields
            ));
          
          await Promise.all(saves);
          await invalidate("custom:object");
          componentChanges.clear();
          componentChanges = new Map(componentChanges);
        }
      });
    }
  };

  // Create new datasource
  const handleAddDataSource = async () => {
    if (creating) return;
    creating = true;
    try {
      const timestamp = Date.now();
      const defaultName = t("objects.institution_data.default-name", {
        fallback: "Data source {{date}}",
        date: epochToDate(timestamp, true),
      });

      const { result, error } = await createDatasource({
        name: defaultName,
        institutionId,
        languageId: defaultLanguageId,
        date: new Date(timestamp).toISOString(),
      });

      if (error) {
        console.error("Failed to create datasource:", error);
        return;
      }

      const newDatasource = Array.isArray(result) ? result[0] : result;

      if (object?.id && newDatasource?.id) {
        await saveOntologyFieldsForDatasource(object.id, newDatasource.id, null, []);
      }

      if (!newDatasource.name) newDatasource.name = { content: defaultName };
      localDatasources.push(newDatasource);

      await invalidateAll();
      activeDatasourceId = newDatasource.id;

      await tick();
      tabsContainer?.scrollTo({ left: tabsContainer.scrollWidth, behavior: "smooth" });
    } finally {
      creating = false;
    }
  };

  // Delete datasource
  const requestDeleteDataSource = (datasourceId) => {
    datasourceToDeleteId = datasourceId;
    deleteDialogOpen = true;
  };

  const performDeleteDataSource = async () => {
    if (!datasourceToDeleteId || deleting) return;
    
    deleting = true;
    const datasourceId = datasourceToDeleteId;
    
    // Switch to another datasource if deleting the active one
    if (activeDatasourceId === datasourceId) {
      const index = datasourcesArray.findIndex(d => d.id === datasourceId);
      const next = datasourcesArray[index > 0 ? index - 1 : index + 1];
      activeDatasourceId = next?.id || null;
    }

    const { error } = await deleteDatasourceFromObject(object.id, datasourceId);

    if (error) {
      console.error("Failed to delete datasource:", error);
    } else {
      componentChanges.delete(`datasource-${datasourceId}`);
      componentChanges = new Map(componentChanges);
      await invalidate("custom:object");
    }
    
    deleting = false;
    deleteDialogOpen = false;
    datasourceToDeleteId = null;
  };

  const handleEditDataSource = (datasourceId) => {
    datasourceToEdit = datasourcesArray.find(d => d.id === datasourceId);
    if (datasourceToEdit) editModalOpen = true;
  };

  const getDatasourceTab = (ds) => ({
    label: ds.name?.content || t("common.unnamed", { fallback: "Unnamed" }),
    onClick: () => activeDatasourceId = ds.id,
  });

  const getDatasourceActions = (ds) => [
    { label: t("common.edit", { fallback: "Edit" }), icon: "pencil", onClick: () => handleEditDataSource(ds.id) },
    { label: t("common.delete", { fallback: "Delete" }), icon: "trash", class: "text-danger", onClick: () => requestDeleteDataSource(ds.id) },
  ];

  const allDatasourcesMenu = $derived(datasourcesArray.map(getDatasourceTab));
</script>

<div class="d-flex flex-column gap-3">
    <div class="d-flex align-items-center justify-content-between">
        <span class="form-label mb-0">
            {t("objects.institution_data.title", { fallback: "Institution metadata" })}
        </span>
        <BaseButton
            class="btn btn-sm btn-outline-secondary"
            icon="plus-lg"
            text={t("objects.add-data-source", { fallback: "Add data source" })}
            onClick={handleAddDataSource}
            disabled={creating}
        />
    </div>

    <div class="border rounded-3 bg-white">
    {#if datasourcesArray.length > 0}
      <!-- Tabs Strip -->
      <div class="d-flex align-items-center border-bottom">
          <div class="flex-grow-1 overflow-hidden d-flex" bind:this={tabsContainer} style="white-space: nowrap; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none;">
              {#each datasourcesArray as datasource (datasource.id)}
                  <!-- svelte-ignore a11y_click_events_have_key_events -->
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div 
                    class="d-flex align-items-center px-3 py-2 border-end cursor-pointer position-relative user-select-none {activeDatasourceId === datasource.id ? 'fw-bold border-bottom border-bottom-0' : 'text-muted'}"
                    style="max-width: 400px; min-width: 120px; flex-shrink: 0; height: 42px; cursor: pointer; border-bottom: {activeDatasourceId === datasource.id ? '2px solid white' : 'none'}; margin-bottom: -1px;"
                    onclick={() => activeDatasourceId = datasource.id}
                  >
                        <span class="text-truncate flex-grow-1 me-2" title={datasource.name?.content}>
                            {datasource.name?.content || t("common.unnamed", { fallback: "Unnamed" })}
                        </span>
                        
                        <div onclick={(e) => e.stopPropagation()} class="d-flex align-items-center">
                            <BaseDropdownMenu
                                items={getDatasourceActions(datasource)}
                                triggerClass="btn btn-sm btn-link text-muted border-0 bg-transparent p-0 shadow-none"
                                side="bottom"
                                align="end"
                            >
                                {#snippet trigger()}
                                    <i class="bi bi-three-dots-vertical"></i>
                                {/snippet}
                            </BaseDropdownMenu>
                        </div>
                  </div>
              {/each}
          </div>

          {#if datasourcesArray.length > 1}
            <div class="d-flex border-start bg-white">
              <button class="btn btn-sm btn-link text-muted rounded-0 border-end py-2" onclick={() => tabsContainer?.scrollBy({ left: -400, behavior: "smooth" })} aria-label={t("objects.institution_data.scroll-left", { fallback: "Scroll tabs left" })}>
                    <i class="bi bi-caret-left-fill"></i>
                </button>
              <button class="btn btn-sm btn-link text-muted rounded-0 border-end py-2" onclick={() => tabsContainer?.scrollBy({ left: 400, behavior: "smooth" })} aria-label={t("objects.institution_data.scroll-right", { fallback: "Scroll tabs right" })}>
                    <i class="bi bi-caret-right-fill"></i>
                </button>
                <div class="d-flex align-items-center">
                    <BaseDropdownMenu 
                        items={allDatasourcesMenu} 
                        side="bottom"
                        align="end"
                        triggerClass="btn btn-sm btn-link text-muted rounded-0 py-2 border-0 bg-transparent shadow-none"
                    >
                         {#snippet trigger()}
                            <i class="bi bi-list"></i>
                         {/snippet}
                    </BaseDropdownMenu>
                </div>
            </div>
          {/if}
      </div>

      <!-- Active Content -->
      <div class="p-3">
        {#each datasourcesArray as datasource (datasource.id)}
            {#if activeDatasourceId === datasource.id}
                <ObjectInstitutionalDataSource
                    {datasource}
                    {templates}
                    {ontologyFields}
                    existingTemplate={datasourceTemplateMap.get(datasource.id)}
                    existingFields={datasourceFieldsMap.get(datasource.id) || []}
                    objectId={object.id}
                    {projectId}
                    {institutionId}
                    onChangesUpdate={handleComponentChanges}
                />
            {/if}
        {/each}
      </div>

    {:else}
      <div class="text-muted small py-3 text-center">
          {t("objects.no-institution-data-found", {
            fallback: "No data sources found",
          })}
      </div>
    {/if}
    </div>
</div>

<BaseAlertDialog bind:open={deleteDialogOpen}>
  {#snippet title()}
    {t("objects.delete-datasource.title", { fallback: "Delete data source" })}
  {/snippet}
  {#snippet description()}
    <p>{t("objects.delete-datasource.confirm", { fallback: "Are you sure you want to delete this data source?" })}</p>
    <p class="text-muted small mb-0">
      {t("objects.delete-datasource.impact", { 
        fallback: "This will permanently delete all institutional field values for this data source." 
      })}
    </p>
  {/snippet}
  {#snippet footer()}
    <button
      class="btn btn-outline-secondary"
      onclick={() => { if (!deleting) deleteDialogOpen = false; }}
      disabled={deleting}
    >
      {t("common.cancel", { fallback: "Cancel" })}
    </button>
    <button
      class="btn btn-danger"
      onclick={performDeleteDataSource}
      disabled={deleting}
    >
      {deleting 
        ? t("common.processing", { fallback: "Processing..." }) 
        : t("common.delete", { fallback: "Delete" })}
    </button>
  {/snippet}
</BaseAlertDialog>

{#if editModalOpen}
    {#snippet editHeader()}
        {t("objects.edit-datasource", { fallback: "Edit Data Source" })}
    {/snippet}

    {#snippet editBody()}
        <div class="container-fluid mt-0 p-0">
             {#if datasourceToEdit}
                <DatasourceEditForm 
                    datasource={datasourceToEdit}
                    {languages}
                    {institutionId}
                    bind:form={editForm}
                    onSuccess={handleEditSuccess}
                />
            {/if}
        </div>
    {/snippet}

    {#snippet editActions()}
        <div class="d-flex justify-content-end gap-2">
            <BaseButton 
                class="btn btn-secondary" 
                text={t("common.cancel", { fallback: "Cancel" })} 
                onClick={() => { editModalOpen = false; }} 
            />
            <BaseButton 
                class="btn btn-primary" 
                text={t("common.save", { fallback: "Save" })} 
                onClick={() => editForm?.handleSubmit()} 
            />
        </div>
    {/snippet}

    <BaseModal bind:isOpen={editModalOpen} size="lg" header={editHeader} body={editBody} actions={editActions} />
{/if}

