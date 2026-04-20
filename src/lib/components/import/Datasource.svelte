<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createDatasource, updateDatasource, getDatasource } from "$lib/stores/DatasourcesUtils.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import { queryParameters, ssp } from "sveltekit-search-params";
  import { onMount } from "svelte";

  const translationStore = getTranslationStore();
  const t = $derived(translationStore.t);
  const wizard = getImportWizardContext();

  // Props & Derived
  const { institutions, languages, templates } = $props();
  const defaultLanguage = $derived(languages?.find((lang) => lang.is_default) || languages?.[0]);
  const secondaryLanguages = $derived(languages?.filter((lang) => !lang.is_default) || []);
  const params = queryParameters({ institution_id: ssp.string(undefined) });

  // Constants
  const TRANSLATABLE_FIELDS = ["name", "method", "notes"];
  const validator = $derived(getValidator("datasources", "create"));
  const translationsValidator = $derived(getValidator("translations", "create"));

  // State
  let allValidationErrors = $state([]);
  let loading = $state(false);
  let initialValues = $state({});

  onMount(async () => {
    if (params.institution_id && !wizard.institutionId) {
      wizard.institutionId = params.institution_id;
    }

    if (wizard.datasourceId) {
      loading = true;
      const { result } = await getDatasource(wizard.datasourceId);
      if (result) {
        wizard.institutionId = result.institution_id || wizard.institutionId;
        const values = {
          institutionId: result.institution_id,
          date: result.date,
          // Handle potential object fields from Text/Translations structure by taking .content
          name: result.name?.content || (typeof result.name === 'string' ? result.name : ""),
          method: result.method?.content || (typeof result.method === 'string' ? result.method : ""),
          notes: result.notes?.content || (typeof result.notes === 'string' ? result.notes : ""),
          copyright: result.copyright,
          contact: result.contact,
          language: result.language,
        };

        // Populate translations for secondary languages
        secondaryLanguages.forEach((lang) => {
          TRANSLATABLE_FIELDS.forEach((field) => {
            const fieldData = result[field];
            if (fieldData?.translations && Array.isArray(fieldData.translations)) {
              // Find translation matching the language code
              const translation = fieldData.translations.find(
                (t) => t.language?.code === lang.code || t.language_code === lang.code
              );
              if (translation) {
                values[`translations_${lang.id}_${field}`] = translation.content;
              }
            }
          });
        });

        initialValues = values;
      }
      loading = false;
    }
  });

  // Helper to build translations payload for create/update
  const buildTranslationsPayload = (formValues) => {
    const translations = { name: [], method: [], notes: [] };
    
    secondaryLanguages.forEach(lang => {
      TRANSLATABLE_FIELDS.forEach(field => {
        const content = formValues[`translations_${lang.id}_${field}`];
        if (content) {
          translations[field].push({ language_code: lang.code, content });
        }
      });
    });

    return {
      nameTranslations: translations.name.length ? translations.name : undefined,
      methodTranslations: translations.method.length ? translations.method : undefined,
      notesTranslations: translations.notes.length ? translations.notes : undefined,
    };
  };

  // Helper to clean translation fields from payload
  const cleanPayload = (formValues) => {
    const payload = { ...formValues };
    Object.keys(payload).forEach(key => {
      if (key.startsWith("translations_")) delete payload[key];
    });
    delete payload.templateId;
    return payload;
  };

  // Create the form
  const form = $derived(createForm(() =>
    getFormConfig("datasources", "create", {
      defaultValues: {
        date: new Date().toISOString(),
        languageId: defaultLanguage?.id,
        institutionId: params.institution_id || undefined,
        ...initialValues,
      },
      onSubmit: async ({ value }) => {
        try {
          const payload = cleanPayload(value);
          const translations = buildTranslationsPayload(value);
          const finalPayload = { ...payload, ...translations };
          wizard.institutionId = finalPayload.institutionId || null;

          if (!wizard.datasourceId) {
            const result = await createDatasource(finalPayload);
            if (result?.error) {
              console.error("Error creating datasource:", result.error);
              return;
            }
            wizard.datasourceId = result.result[0].id;
          } else {
            const updateResult = await updateDatasource(wizard.datasourceId, finalPayload);
            if (updateResult?.error) {
              console.error("Error updating datasource:", updateResult.error);
              return;
            }
          }
          wizard.nextEnabled = true;
        } catch (error) {
          console.error("Error creating datasource:", error);
        }
      },
    }),
  ));

  // UI Configuration
  const uiSchema = $derived({
    languageId: { hidden: true },
    templateId: { hidden: true },
    source: { hidden: true },
    importId: { hidden: true },
    name: { label: t("common.datasource-name", { fallback: "Datasource Name" }), colSize: 9 },
    method: { type: "textarea", label: t("common.method", { fallback: "Method" }), colSize: 9 },
    notes: { type: "textarea", label: t("common.notes", { fallback: "Notes" }), colSize: 9 },
    institutionId: {
      type: "select",
      label: t("common.institution", { fallback: "Institution" }),
      options: institutions.map((i) => ({ value: i.id, label: i.name.content })),
      colSize: 9,
    },
    date: { type: "date", label: t("common.date", { fallback: "Date" }), colSize: 9 },
    language: { label: t("common.datasource-language", { fallback: "Datasource Language" }), colSize: 9 },
    copyright: { label: t("common.copyright", { fallback: "Copyright" }), colSize: 9 },
    contact: { label: t("common.contact", { fallback: "Contact" }), colSize: 9 },
  });

  const fieldOrder = ["institutionId", "date", "language", "copyright", "contact"];
</script>

<form onsubmit={(e) => { e.preventDefault(); e.stopPropagation(); form.handleSubmit(); }}>
  <div class="container-fluid">
    <div class="row">
      <div class="col-12">
        <h2 class="mt-3">{t("common.add-new-datasource", { fallback: "Add New Datasource" })}</h2>
        <p>{t("common.add-new-datasource-desc", { fallback: "Please fill out the details below to add a new datasource to your project." })}</p>
      </div>
    </div>

    {#if loading}
      <div class="d-flex justify-content-center p-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    {:else}
      <div class="row">
        <div class="col-12">
          <AutoForm
            {form}
            {validator}
            {createFieldValidator}
            entity="datasources"
            operation="create"
            {languages}
            translatableFields={TRANSLATABLE_FIELDS}
            {translationsValidator}
            defaultColSize={9}
            {fieldOrder}
            hiddenStaticValues={{ templateId: null }}
            {uiSchema}
            usePortal={false}
            enableDirtyTracking={false}
            
          />
        </div>
      </div>

      <div class="row mt-0 bg-white border-top py-2" style="position: sticky; bottom: 0; z-index: 100;">
        <div class="col-12 d-flex align-items-center justify-content-end">
          <BaseButton type="submit" class="btn btn-success btn-sm" text={t("common.confirm", { fallback: "Confirm" })} />
        </div>
      </div>
    {/if}
  </div>
</form>
