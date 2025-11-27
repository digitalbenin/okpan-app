<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createDatasource, updateDatasource } from "$lib/stores/DatasourcesUtils.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import { queryParameters, ssp } from "sveltekit-search-params";

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
      },
      onSubmit: async ({ value }) => {
        try {
          const payload = cleanPayload(value);
          const translations = buildTranslationsPayload(value);
          const finalPayload = { ...payload, ...translations };

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
    name: { label: t("common.datasource-name", { fallback: "Datasource Name" }), colSize: 6 },
    method: { type: "textarea", label: t("common.method", { fallback: "Method" }), colSize: 6 },
    notes: { type: "textarea", label: t("common.notes", { fallback: "Notes" }), colSize: 6 },
    institutionId: {
      type: "select",
      label: t("common.institution", { fallback: "Institution" }),
      options: institutions.map((i) => ({ value: i.id, label: i.name.content })),
      colSize: 6,
    },
    date: { type: "date", label: t("common.date", { fallback: "Date" }), colSize: 6 },
    language: { label: t("common.datasource-language", { fallback: "Datasource Language" }), colSize: 6 },
    copyright: { label: t("common.copyright", { fallback: "Copyright" }), colSize: 6 },
    contact: { label: t("common.contact", { fallback: "Contact" }), colSize: 6 },
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
          defaultColSize={6}
          {fieldOrder}
          hiddenStaticValues={{ templateId: null }}
          {uiSchema}
        />
      </div>
    </div>

    <div class="row mt-0">
      <div class="col-12">
        <BaseButton type="submit" class="btn btn-success" text={t("common.confirm", { fallback: "Confirm" })} />
      </div>
    </div>
  </div>
</form>
