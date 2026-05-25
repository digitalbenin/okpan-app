<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/utils/formValidation.js";
  import { updateDatasource } from "$lib/api/DatasourcesApi.js";

  let { 
    datasource = {}, 
    languages = [], 
    institutionId = null,
    form = $bindable(), 
    onSuccess 
  } = $props();

  const translationStore = getTranslationStore();
  const contentLanguageStore = getContentLanguageStore();
  const t = $derived(translationStore.t);

  const defaultLanguage = $derived(languages?.find((l) => l.is_default) || languages?.[0] || null);
  const secondaryLanguages = $derived(languages?.filter((l) => !l.is_default) || []);
  const TRANSLATABLE_FIELDS = ["name", "method", "notes"];
  const validator = $derived(getValidator("datasources", "update"));
  const translationsValidator = $derived(getValidator("translations", "create"));

  // Helper - build translations payload
  const buildTranslationsPayload = (formValues) => {
    const translations = { name: [], method: [], notes: [] };
    
    secondaryLanguages.forEach(lang => {
      TRANSLATABLE_FIELDS.forEach(field => {
        const content = formValues[`translations_${lang.id}_${field}`];
        const existingId = contentLanguageStore.getExistingTranslationId(datasource?.[field], lang.code);
        
        if (content?.trim()) {
          translations[field].push({ 
            ...(existingId && { id: existingId }), 
            language_code: lang.code, 
            content: content.trim() 
          });
        }
      });
    });

    return {
      nameTranslations: translations.name.length ? translations.name : undefined,
      methodTranslations: translations.method.length ? translations.method : undefined,
      notesTranslations: translations.notes.length ? translations.notes : undefined,
    };
  };

  // Default values
  const defaultValues = $derived.by(() => {
    // console.log('[DatasourceEditForm] Processing default values. Date:', datasource?.date, typeof datasource?.date);
    
    let sourceDate = datasource?.date;

    // Handle string-encoded timestamps (common in GraphQL/JSON for large ints)
    if (typeof sourceDate === 'string' && /^\d+$/.test(sourceDate)) {
        sourceDate = parseInt(sourceDate, 10);
    }
    
    // If still empty/invalid, fallback to today ONLY if strictly needed,
    // otherwise try to maintain what we have or valid "now".
    // But since validation requires non-empty, we default to now if missing.
    if (!sourceDate) {
        sourceDate = Date.now();
    }

    const dateObj = new Date(sourceDate);
    
    // Ensure valid ISO string for the form validator
    // If dateObj is invalid (e.g. from bad string), fallback to now
    const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

    const baseValues = {
      date: dateStr,
      language: datasource?.language || "",
      contact: datasource?.contact || "",
      copyright: datasource?.copyright || "",
    };

    TRANSLATABLE_FIELDS.forEach(field => {
      baseValues[field] = datasource?.[field]?.content || "";
    });

    Object.assign(baseValues, contentLanguageStore.buildTranslationFormValues(datasource, secondaryLanguages, TRANSLATABLE_FIELDS));

    return baseValues;
  });

  // UI configuration
  const uiSchema = $derived({
    id: { hidden: true },
    datasourceId: { hidden: true },
    institutionId: { hidden: true },
    languageId: { hidden: true },
    importId: { hidden: true },
    templateId: { hidden: true },
    name: { label: t("common.name", { fallback: "Name" }), type: "text", placeholder: t("common.name", { fallback: "Name" }) },
    method: { label: t("import.method", { fallback: "Method" }), type: "textarea", placeholder: t("import.method", { fallback: "Describe method" }) },
    notes: { label: t("common.notes", { fallback: "Notes" }), type: "textarea", placeholder: t("common.notes", { fallback: "Notes" }) },
    date: { label: t("common.date", { fallback: "Date" }), type: "date" },
  });

  const hiddenStaticValues = $derived({
    languageId: defaultLanguage?.id || "",
    datasourceId: String(datasource?.id || ""),
    institutionId: String(institutionId || datasource?.institution_id || ""),
  });
  
  // Create form
  const _form = $derived(createForm(() =>
    getFormConfig("datasources", "update", {
      defaultValues,
      onSubmit: async ({ value }) => {
        const translations = buildTranslationsPayload(value);
        
        const payload = {
          name: value.name,
          method: value.method,
          notes: value.notes,
          date: value.date,
          language: value.language,
          contact: value.contact,
          copyright: value.copyright,
          languageId: defaultLanguage?.id,
          ...translations,
        };
        const { error, result } = await updateDatasource(datasource.id, payload);
        if (!error) {
             _form.reset();
             // Build the updated datasource object with the new values
             // The API result doesn't return the complete datasource, so we construct it
             const updatedDatasource = {
                ...datasource,
                date: value.date,
                language: value.language,
                contact: value.contact,
                copyright: value.copyright,
                name: { 
                    ...datasource.name,
                    content: value.name 
                },
                method: value.method ? { 
                    ...datasource.method,
                    content: value.method 
                } : datasource.method,
                notes: value.notes ? { 
                    ...datasource.notes,
                    content: value.notes 
                } : datasource.notes
             };
             if (onSuccess) onSuccess(updatedDatasource);
        }
      },
    }),
  ));

  $effect(() => {
    form = _form;
  });

</script>

<AutoForm
    form={_form}
    {validator}
    {createFieldValidator}
    {languages}
    translatableFields={TRANSLATABLE_FIELDS}
    {translationsValidator}
    {hiddenStaticValues}
    fieldOrder={["date"]}
    {uiSchema}
    usePortal={false}
/>
