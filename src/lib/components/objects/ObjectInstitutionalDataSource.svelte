<script>
  import { goto } from "$app/navigation";
  import { watch } from "runed";
  import BaseSelectNew from "$lib/components/base/BaseSelectNew.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const {
    datasource,
    templates = [],
    ontologyFields = [],
    existingTemplate = null,
    existingFields = [],
    objectId,
    projectId,
    institutionId,
    onChangesUpdate = null,
    onDelete = null,
  } = $props();

  const { t } = getTranslationStore();

  let selectedTemplateId = $state(existingTemplate?.id || null);
  let fieldValues = $state(new Map());
  let initialValues = $state(new Map());
  let deleteDialogOpen = $state(false);
  let deleting = $state(false);

  const selectedTemplate = $derived(
    selectedTemplateId 
      ? templates.find(t => t.id === selectedTemplateId)
      : existingTemplate
  );

  const isTemplateSelected = $derived(!!selectedTemplate);
  const templateLocked = $derived(!!existingTemplate);

  // Build mapped fields from template
  const mappedFields = $derived.by(() => {
    if (!selectedTemplate?.mapping) {
      console.log('No template or mapping found');
      return [];
    }
    
    console.log('Raw template mapping:', selectedTemplate.mapping);
    console.log('Mapping type:', typeof selectedTemplate.mapping);
    
    // Parse mapping if it's a string
    let mapping = selectedTemplate.mapping;
    if (typeof mapping === 'string') {
      try {
        mapping = JSON.parse(mapping);
        console.log('Parsed mapping:', mapping);
      } catch (e) {
        console.error('Failed to parse template mapping:', e);
        return [];
      }
    }
    
    if (!Array.isArray(mapping)) {
      console.log('Mapping is not an array:', mapping);
      return [];
    }
    
    console.log('First mapping item:', mapping[0]);
    
    return mapping.map((item, index) => {
      console.log(`Processing item ${index}:`, item);
      
      // Parse each item if it's a string
      let parsedItem = item;
      if (typeof item === 'string') {
        try {
          parsedItem = JSON.parse(item);
          console.log(`  Parsed item:`, parsedItem);
        } catch (e) {
          console.error('Failed to parse item:', item, e);
          return null;
        }
      }
      
      const ontologyField = ontologyFields.find(f => f.id === parsedItem.mappedField);
      const institutionFieldName = parsedItem.headerField || `Unnamed Field ${index + 1}`;
      const ontologyFieldName = ontologyField?.name?.content || "Not mapped";
      
      console.log(`  institutionField: ${institutionFieldName}`);
      console.log(`  ontologyFieldName: ${ontologyFieldName}`);
      
      return {
        institutionField: institutionFieldName,
        ontologyFieldId: parsedItem.mappedField || "",
        ontologyFieldName: ontologyFieldName,
        primary: parsedItem.primary || false,
        uniqueKey: `${institutionFieldName}-${parsedItem.mappedField || `id-${index}`}`,
      };
    }).filter(Boolean);
  });

  // Initialize field values from existing fields
  const initializeFieldValues = () => {
    const newValues = new Map();
    
    mappedFields.forEach(field => {
      // Match by label (institution field name) only, not field_id
      // This allows values to persist when template mappings change
      const existingField = existingFields.find(
        ef => ef.label === field.institutionField
      );
      const value = existingField?.value || "";
      newValues.set(field.institutionField, value);
    });
    
    fieldValues = newValues;
    initialValues = new Map(newValues);
  };

  // Watch for template selection and initialize values
  watch(
    () => selectedTemplate,
    (template) => {
      if (template) {
        initializeFieldValues();
      }
    },
    { lazy: false }
  );

  // Track changes
  const hasChanges = $derived.by(() => {
    if (fieldValues.size !== initialValues.size) return true;
    for (const [key, value] of fieldValues) {
      if (initialValues.get(key) !== value) return true;
    }
    return false;
  });

  // Notify parent of changes
  watch(
    () => hasChanges,
    (changed) => {
      if (onChangesUpdate) {
        onChangesUpdate({
          component: `datasource-${datasource.id}`,
          hasChanges: changed,
          getData: () => {
            const fieldsData = Array.from(fieldValues.entries()).map(([institutionField, value]) => {
              const field = mappedFields.find(f => f.institutionField === institutionField);
              return {
                label: institutionField,
                value,
                field_id: field?.ontologyFieldId,
                datasources_id: datasource.id,
                primary: field?.primary ? 1 : 0,
              };
            });
            console.log('getData called - current fieldValues:', {
              datasourceId: datasource.id,
              templateId: selectedTemplate?.id,
              fieldsCount: fieldsData.length,
              fields: fieldsData,
              fieldValuesMap: Array.from(fieldValues.entries())
            });
            return {
              datasourceId: datasource.id,
              templateId: selectedTemplate?.id,
              fields: fieldsData,
            };
          },
        });
      }
    }
  );

  const handleCreateTemplate = () => {
    goto(`/projects/${projectId}/institutions/${institutionId}?view=mappings`);
  };

  const handleFieldChange = (institutionField, newValue) => {
    const currentValue = fieldValues.get(institutionField) || "";
    fieldValues.set(institutionField, newValue);
    fieldValues = new Map(fieldValues);
  };

  const handleDelete = async () => {
    if (deleting || !onDelete) return;
    deleting = true;
    await onDelete(datasource.id);
    deleting = false;
    deleteDialogOpen = false;
  };

  // Build template items for dropdown
  const templateItems = $derived(
    templates.map(t => ({
      value: t.id,
      label: t.name || `Template ${t.id}`,
    }))
  );
</script>

<div class="border-top pt-3 mt-3">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>
      <div class="fw-medium">{datasource?.name?.content || "Data source"}</div>
      {#if selectedTemplate}
        <div class="text-muted small mt-1">
          {t("objects.template", { fallback: "Template" })}: {selectedTemplate.name || "Untitled"}
        </div>
      {/if}
    </div>
    {#if onDelete}
      <BaseButton
        class="btn btn-sm btn-outline-danger"
        icon="trash"
        onClick={() => { deleteDialogOpen = true; }}
      />
    {/if}
  </div>

    {#if !isTemplateSelected}
      <!-- Empty State: Template Selection -->
      <div class="mb-3">
        <div class="text-muted small text-uppercase mb-2">
          {t("objects.select-mapping-template", { fallback: "Select the mapping template" })}
        </div>
        <div class="d-flex gap-2 align-items-center">
          <div class="flex-grow-1">
            <BaseSelectNew
              bind:value={selectedTemplateId}
              items={templateItems}
              placeholder={t("common.select", { fallback: "Select" })}
              size="sm"
              disabled={templateLocked}
            />
          </div>
          <span class="text-muted">{t("common.or", { fallback: "or" })}</span>
          <BaseButton
            class="btn btn-sm btn-outline-primary"
            icon="plus-lg"
            text={t("objects.create-new-template", { fallback: "Create a new template" })}
            onClick={handleCreateTemplate}
          />
        </div>
      </div>
    {:else}
      <!-- Populated State: Mapped Fields Table -->
      <div class="mb-3">
        <table class="table table-borderless">
          <thead>
            <tr class="border-bottom">
              <th scope="col" class="fw-normal text-muted">
                {t("objects.institution-field", { fallback: "Institution field" })}
              </th>
              <th scope="col" class="fw-normal text-muted">
                {t("objects.value", { fallback: "Value" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each mappedFields as field (field.uniqueKey)}
              <tr class="border-bottom">
                <td class="align-middle" style="width: 40%;">
                  <div class="mb-1">{field.institutionField}</div>
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-arrow-right text-muted small"></i>
                    <span class="text-muted small">{field.ontologyFieldName}</span>
                  </div>
                </td>
                <td class="align-middle">
                  <BaseInput
                    value={fieldValues.get(field.institutionField) || ""}
                    placeholder={t("objects.add-value-placeholder", { 
                      fallback: "Add subfolder path if not served from root" 
                    })}
                    size="sm"
                    onInput={(e) => handleFieldChange(field.institutionField, e.target.value)}
                  />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

<BaseAlertDialog bind:open={deleteDialogOpen}>
  {#snippet title()}
    {t("objects.delete-datasource.title", { fallback: "Delete data source" })}
  {/snippet}
  {#snippet description()}
    <p>{t("objects.delete-datasource.confirm", { fallback: "Are you sure you want to delete this data source?" })}</p>
    <p class="fw-medium mb-2">{datasource?.name?.content || "Data source"}</p>
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
      onclick={handleDelete}
      disabled={deleting}
    >
      {deleting 
        ? t("common.processing", { fallback: "Processing..." }) 
        : t("common.delete", { fallback: "Delete" })}
    </button>
  {/snippet}
</BaseAlertDialog>
