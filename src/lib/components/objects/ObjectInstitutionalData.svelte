<script>
  import { invalidate } from "$app/navigation";
  import ObjectInstitutionalDataSource from "./ObjectInstitutionalDataSource.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
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
    onChangesUpdate = null,
  } = $props();

  const { t } = getTranslationStore();

  let datasourcesArray = $state([...datasources]);
  let creating = $state(false);
  let componentChanges = $state(new Map());

  console.log('ObjectInstitutionalData loaded:', {
    datasourcesCount: datasources.length,
    datasources,
    objectDatasources: object?.objectsDatasources,
    objectOntologyFields: object?.objectsOntologyFields
  });

  // Build map of datasource -> template from object's objectsDatasources
  const datasourceTemplateMap = $derived.by(() => {
    const map = new Map();
    const objectDatasources = object?.objectsDatasources || [];
    objectDatasources.forEach(od => {
      if (od.datasource_id && od.template) {
        map.set(od.datasource_id, od.template);
      }
    });
    return map;
  });

  // Build map of datasource -> ontology fields from object's objectsOntologyFields
  const datasourceFieldsMap = $derived.by(() => {
    const map = new Map();
    const ontologyFields = object?.objectsOntologyFields || [];
    ontologyFields.forEach(field => {
      if (field.datasources_id) {
        if (!map.has(field.datasources_id)) {
          map.set(field.datasources_id, []);
        }
        map.get(field.datasources_id).push(field);
      }
    });
    return map;
  });

  // Track changes from child components
  const handleComponentChanges = (changeData) => {
    componentChanges.set(changeData.component, changeData);
    componentChanges = new Map(componentChanges);
    
    // Notify parent if callback provided
    if (onChangesUpdate) {
      const hasAnyChanges = Array.from(componentChanges.values()).some(
        (comp) => comp.hasChanges
      );
      
      // Create save function that saves all datasource changes
      const saveFunction = async () => {
        const savePromises = [];
        for (const [_, changeData] of componentChanges) {
          if (changeData.hasChanges && changeData.getData) {
            const data = changeData.getData();
            savePromises.push(
              saveOntologyFieldsForDatasource(
                object.id,
                data.datasourceId,
                data.templateId,
                data.fields
              )
            );
          }
        }
        await Promise.all(savePromises);
        await invalidate("custom:object");
        
        // Reset changes after successful save
        componentChanges.clear();
        componentChanges = new Map(componentChanges);
      };
      
      onChangesUpdate({
        component: "institutional-data",
        hasChanges: hasAnyChanges,
        saveFunction,
      });
    }
  };

  // Create new datasource
  const handleAddDataSource = async () => {
    if (creating) return;
    
    creating = true;
    
    const timestamp = new Date().toISOString();
    const defaultName = `Data source ${epochToDate(Date.now(), true)}`;
    
    const { result, error } = await createDatasource({
      name: defaultName,
      institutionId,
      languageId: defaultLanguageId,
      date: timestamp,
    });
    creating = false;

    if (error) {
      console.error("Failed to create datasource:", error);
      return;
    }

    if (result) {
      // Add to local array - result is an array from the mutation
      const newDatasource = Array.isArray(result) ? result[0] : result;
      datasourcesArray = [...datasourcesArray, newDatasource];
      await invalidate("custom:object");
    }
  };

  // Delete datasource
  const handleDeleteDataSource = async (datasourceId) => {
    const { error } = await deleteDatasourceFromObject(object.id, datasourceId);

    if (error) {
      console.error("Failed to delete datasource:", error);
      return;
    }

    // Remove from local array
    datasourcesArray = datasourcesArray.filter((ds) => ds.id !== datasourceId);
    
    // Remove from changes tracking
    componentChanges.delete(`datasource-${datasourceId}`);
    componentChanges = new Map(componentChanges);
    
    await invalidate("custom:object");
  };
</script>

<div class="card bg-white border-0">
  <div class="card-body">
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-table"></i>
        <span>
          {t("objects.institution_data.title", { fallback: "Institution Data" })}
        </span>
      </div>
      <BaseButton
        class="btn btn-sm btn-light"
        icon="plus-lg"
        text={t("objects.add-data-source", { fallback: "Add data source" })}
        onClick={handleAddDataSource}
        disabled={creating}
      />
    </div>

    {#if datasourcesArray.length > 0}
      {#each datasourcesArray as datasource (datasource.id)}
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
        onDelete={handleDeleteDataSource}
      />
    {/each}
    {:else}
      <div class="text-muted small pb-2">
        <div class="mt-2">
          {t("objects.no-institution-data-found", {
            fallback: "No institution data found for this object",
          })}
        </div>
      </div>
    {/if}
  </div>
</div>
