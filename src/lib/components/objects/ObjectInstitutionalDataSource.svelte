<script>
  import { goto } from "$app/navigation";
  import { watch } from "runed";
  import BaseSelectNew from "$lib/components/base/BaseSelectNew.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
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
  } = $props();

  const { t } = getTranslationStore();

  let selectedTemplateId = $state(existingTemplate?.id || null);
  let fieldValues = $state(new Map());
  let initialValues = $state(new Map());

  const selectedTemplate = $derived.by(() => {
    if (selectedTemplateId) {
      // First try to find in available templates list
      const fromList = templates.find(t => t.id === selectedTemplateId);
      if (fromList) return fromList;
      
      // If not in list but matches existing template (e.g. from different institution), use existing
      if (existingTemplate && existingTemplate.id === selectedTemplateId) {
        return existingTemplate;
      }
    }
    return existingTemplate;
  });

  const isTemplateSelected = $derived(!!selectedTemplate);
  const templateLocked = $derived(!!existingTemplate);

  // Build mapped fields from template
  const mappedFields = $derived.by(() => {
    if (!selectedTemplate?.mapping) {
      return [];
    }
    
    // Parse mapping if it's a string
    let mapping = selectedTemplate.mapping;
    if (typeof mapping === 'string') {
      try {
        mapping = JSON.parse(mapping);
      } catch (e) {
        console.error('Failed to parse template mapping:', e);
        return [];
      }
    }
    
    if (!Array.isArray(mapping)) {
      return [];
    }
    
    return mapping.map((item, index) => {
      // Parse each item if it's a string
      let parsedItem = item;
      if (typeof item === 'string') {
        try {
          parsedItem = JSON.parse(item);
        } catch (e) {
          console.error('Failed to parse item:', item, e);
          return null;
        }
      }
      
      const ontologyField = ontologyFields.find(f => f.id === parsedItem.mappedField);
      const institutionFieldName = parsedItem.headerField || `${t("common.unnamed-field", { fallback: "Unnamed field" })} ${index + 1}`;
      const ontologyFieldName = ontologyField?.name?.content || t("common.not-mapped", { fallback: "Not mapped" });
      
      return {
        institutionField: institutionFieldName,
        ontologyFieldId: parsedItem.mappedField || "",
        ontologyFieldName: ontologyFieldName,
        primary: parsedItem.primary || false,
        uniqueKey: `${institutionFieldName}-${parsedItem.mappedField || `id-${index}`}`,
      };
    }).filter(Boolean);
  });

  // Group fields by institution field name for display
  const groupedFields = $derived.by(() => {
    const groups = new Map();
    mappedFields.forEach(field => {
      if (!groups.has(field.institutionField)) {
        groups.set(field.institutionField, {
          institutionField: field.institutionField,
          primary: false,
          mappings: []
        });
      }
      const group = groups.get(field.institutionField);
      group.mappings.push(field);
      if (field.primary) group.primary = true;
    });
    return Array.from(groups.values());
  });

  // Initialize field values from existing fields
  // reason parameter used for internal logic flow or debugging if needed
  const initializeFieldValues = (reason = 'unknown') => {
    const newValues = new Map();
    const newInitialValues = new Map();
    
    mappedFields.forEach(field => {
      // 1. Determine what the "Server" says the value is right now (from props)
      const existingField = existingFields.find(
        ef => ef.label === field.institutionField
      );
      const serverValue = existingField?.value || "";
      newInitialValues.set(field.institutionField, serverValue);

      // 2. Determine what our current local state is
      const localValue = fieldValues.get(field.institutionField);
      // 3. Determine what we thought the server value was previously (baseline)
      const baseValue = initialValues.get(field.institutionField);

      // 4. Resolve Conflict
      // If we are just starting (reason === 'template changed'), take the server value.
      if (reason === 'template changed' || fieldValues.size === 0) {
        newValues.set(field.institutionField, serverValue);
      } else {
        // If this is an update to existing fields (e.g. stale refresh or save confirmation)
        if (serverValue === baseValue && localValue !== undefined && localValue !== baseValue) {
             // Case: Server hasn't changed, but User has unsaved changes.
             // Action: PRESERVE LOCAL CHANGES (Ignore stale refresh)
             newValues.set(field.institutionField, localValue);
        } else {
             // Case: Server has changed (e.g. save completed), OR user matches server.
             // Action: ACCEPT SERVER TRUTH
             newValues.set(field.institutionField, serverValue);
        }
      }
    });
    
    fieldValues = newValues;
    initialValues = newInitialValues;
  };

  // Watch for template selection and initialize values
  // Only re-initialize if the template ID changes, preventing resets on purely referential updates
  watch(
    () => selectedTemplate?.id,
    (newId, oldId) => {
      if (newId && (newId !== oldId || fieldValues.size === 0)) {
        initializeFieldValues('template changed');
      }
    }
  );

  // Watch for updates to existing fields (e.g. after a save or external update)
  watch(
    () => existingFields,
    (fields) => {
      // When backend data syncs down, only overwrite if actually new
      if (selectedTemplate) {
        initializeFieldValues('existingFields changed');
      }
    }
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
            // Iterate over all mappedFields to ensure institution fields mapped to multiple ontology fields are saved correctly
            const fieldsData = mappedFields.map(field => {
              const value = fieldValues.get(field.institutionField) || "";
              return {
                label: field.institutionField,
                value,
                field_id: field.ontologyFieldId,
                datasources_id: datasource.id,
                primary: field.primary ? 1 : 0,
              };
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
    fieldValues.set(institutionField, newValue);
    fieldValues = new Map(fieldValues);
  };

  // Build template items for dropdown
  const templateItems = $derived(
    templates.map(t => ({
      value: t.id,
      label: t.name || `Template ${t.id}`,
    }))
  );
</script>

<div class="mt-3">
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
              <th scope="col" class="fw-bold text-muted">
                {t("objects.institution-field", { fallback: "Institution field" })}
              </th>
              <th scope="col" class="fw-bold text-muted">
                {t("objects.value", { fallback: "Value" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each groupedFields as group (group.institutionField)}
              <tr class="border-bottom">
                <td class="align-middle" style="width: 40%;">
                  <div class="mb-1 d-flex align-items-center">
                    <span>{group.institutionField}</span>
                    {#if group.primary}
                        <i class="bi bi-star-fill text-black ms-2" style="font-size: 0.75rem;" title={t("objects.primary-id", { fallback: "Primary ID" })}></i>
                    {/if}
                  </div>
                  {#each group.mappings as mapping}
                    <div class="d-flex align-items-center gap-2">
                        <i class="bi bi-arrow-right text-muted small"></i>
                        <span class="text-muted small">{mapping.ontologyFieldName}</span>
                    </div>
                  {/each}
                </td>
                <td class="align-middle">
                  <BaseInput
                    value={fieldValues.get(group.institutionField) || ""}
                    placeholder={t("objects.add-value-placeholder", { 
                      fallback: "Add value..." 
                    })}
                    size="sm"
                    onInput={(e) => handleFieldChange(group.institutionField, e.target.value)}
                  />
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
