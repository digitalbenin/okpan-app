<script>
  import { invalidate, goto } from "$app/navigation";
  import { tick } from "svelte";
  import { invalidateAll } from '$app/navigation';
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
  } from "$lib/stores/DatasourcesUtils.js";

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

  const datasourcesArray = $derived.by(() => {
    const combined = [...datasources];
    // Add local datasources that are NOT in props (optimistic updates)
    localDatasources.forEach(local => {
       if (!combined.some(d => d.id === local.id)) {
           combined.push(local);
       }
    });

    const sorted = combined.sort((a, b) => {
      // Convert string timestamps to numbers
      const dateA = typeof a.date === 'number' ? a.date : Number(a.date) || 0;
      const dateB = typeof b.date === 'number' ? b.date : Number(b.date) || 0;
      return dateA - dateB; // Ascending: oldest first (left)
    });
    return sorted;
  });
  
  let creating = $state(false);
  let componentChanges = $state(new Map());
  let activeDatasourceId = $state(null);
  let tabsContainer = $state(null);
  let deleteDialogOpen = $state(false);
  let datasourceToDeleteId = $state(null);
  let deleting = $state(false);

  // Edit modal state
  let editModalOpen = $state(false);
  let datasourceToEdit = $state(null);
  let editForm = $state(null);

  const handleEditSuccess = (updatedDatasource) => {
      editModalOpen = false;
      datasourceToEdit = null;
      invalidate("custom:object");
  };

  // Initialize active datasource
  $effect(() => {
    const hasActive = datasourcesArray.some(d => d.id === activeDatasourceId);
    if (!hasActive && datasourcesArray.length > 0) {
      activeDatasourceId = datasourcesArray[0].id;
    }
  });

  const scrollToTab = (direction) => {
    if (tabsContainer) {
      tabsContainer.scrollBy({ 
        left: direction === 'left' ? -400 : 400, 
        behavior: "smooth" 
      });
    }
  };

  // Build maps for datasource templates and fields
  const { datasourceTemplateMap, datasourceFieldsMap } = $derived.by(() => {
    const templates = new Map();
    const fields = new Map();
    
    (object?.objectsDatasources || []).forEach(od => {
      if (od.datasource_id && od.template) {
        templates.set(od.datasource_id, od.template);
      }
    });
    
    (object?.objectsOntologyFields || []).forEach(field => {
      if (field.datasources_id) {
        if (!fields.has(field.datasources_id)) {
          fields.set(field.datasources_id, []);
        }
        fields.get(field.datasources_id).push(field);
      }
    });
    
    return { datasourceTemplateMap: templates, datasourceFieldsMap: fields };
  });

  // Track changes from child components
  const handleComponentChanges = (changeData) => {
    componentChanges.set(changeData.component, changeData);
    componentChanges = new Map(componentChanges);
    
    // Notify parent if callback provided
    if (onChangesUpdate) {
      const hasAnyChanges = Array.from(componentChanges.values()).some(c => c.hasChanges);
      
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
    
    const timestamp = Date.now();
    const defaultName = t("objects.institution_data.default-name", {
      fallback: "Data source {{date}}",
      date: epochToDate(timestamp, true),
    });
    
    const { result, error } = await createDatasource({
      name: defaultName,
      institutionId,
      languageId: defaultLanguageId,
      date: new Date(timestamp).toISOString(), // ISO string format
    });
    
    if (error) {
      console.error("Failed to create datasource:", error);
      creating = false;
      return;
    }

    if (result) {
      const newDatasource = Array.isArray(result) ? result[0] : result;

      // Link the new datasource to the current object
      if (object && object.id && newDatasource?.id) {
        await saveOntologyFieldsForDatasource(
            object.id, 
            newDatasource.id, 
            null, 
            []
        );
      }
      
      // Add to local state for immediate optimistic update
      // Ensure the name is populated for immediate display in the tab
      if (!newDatasource.name) {
          newDatasource.name = { content: defaultName };
      }
      localDatasources.push(newDatasource);

      // Invalidate to refresh data
      await invalidateAll();
      
      // Select the new datasource after data is refreshed
      activeDatasourceId = newDatasource.id;
      
      // Scroll to end
      await tick();
      if (tabsContainer) {
          tabsContainer.scrollTo({ left: tabsContainer.scrollWidth, behavior: 'smooth' });
      }
    }
    creating = false;
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

  const createDatasourceMenu = (ds, includeActions = false) => {
    if (!includeActions) {
      return { 
        label: ds.name?.content || t("common.unnamed", { fallback: "Unnamed" }), 
        onClick: () => activeDatasourceId = ds.id 
      };
    }
    return [
      { label: t("common.edit", { fallback: "Edit" }), icon: "pencil", onClick: () => handleEditDataSource(ds.id) },
      { label: t("common.delete", { fallback: "Delete" }), icon: "trash", class: "text-danger", onClick: () => requestDeleteDataSource(ds.id) }
    ];
  };

  const allDatasourcesMenu = $derived(datasourcesArray.map(ds => createDatasourceMenu(ds)));
</script>

<div class="card bg-white border-0 pb-4">
  <div class="card-body p-0">
    <div class="d-flex align-items-center justify-content-between p-3 border-bottom">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-table"></i>
        <span>
          {t("objects.institution_data.title", { fallback: "Data sources" })}
        </span>
      </div>
      <BaseButton
        class="btn btn-sm btn-secondary"
        icon="plus-lg"
        text={t("objects.add-data-source", { fallback: "Add data source" })}
        onClick={handleAddDataSource}
        disabled={creating}
      />
    </div>

    <div class="border border-top rounded-top rounded-4 mx-3 mt-3 bg-white">
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
                                items={createDatasourceMenu(datasource, true)}
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
              <button class="btn btn-sm btn-link text-muted rounded-0 border-end py-2" onclick={() => scrollToTab('left')} aria-label={t("objects.institution_data.scroll-left", { fallback: "Scroll tabs left" })}>
                    <i class="bi bi-caret-left-fill"></i>
                </button>
              <button class="btn btn-sm btn-link text-muted rounded-0 border-end py-2" onclick={() => scrollToTab('right')} aria-label={t("objects.institution_data.scroll-right", { fallback: "Scroll tabs right" })}>
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
      <div class="text-muted small pb-2 p-3">
        <div class="mt-2 text-center">
          {t("objects.no-institution-data-found", {
            fallback: "No data sources found",
          })}
        </div>
      </div>
    {/if}
    </div>
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

