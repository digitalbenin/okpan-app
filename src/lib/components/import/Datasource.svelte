<script>
  import { IconBulb } from "@tabler/icons-svelte";
  import { createForm } from "@tanstack/svelte-form";
  import { getValidator, createFieldValidator, getFormConfig } from "$lib/utils/formValidation.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createDatasource, updateDatasource, getDatasource } from "$lib/api/DatasourcesApi.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import { queryParameters, ssp } from "sveltekit-search-params";
  import { onMount, onDestroy } from "svelte";

  import { watch } from "runed";

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
          name: result.name?.content || (typeof result.name === 'string' ? result.name : ""),
          method: result.method?.content || (typeof result.method === 'string' ? result.method : ""),
          notes: result.notes?.content || (typeof result.notes === 'string' ? result.notes : ""),
          copyright: result.copyright,
          contact: result.contact,
          language: result.language,
        };

        secondaryLanguages.forEach((lang) => {
          TRANSLATABLE_FIELDS.forEach((field) => {
            const fieldData = result[field];
            if (fieldData?.translations && Array.isArray(fieldData.translations)) {
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
          translations[field].push({ language_id: lang.id, language_code: lang.code, content });
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
  const form = createForm(() =>
    getFormConfig("datasources", "create", {
      defaultValues: {
        date: new Date().toISOString(),
        languageId: defaultLanguage?.id || '',
        institutionId: params.institution_id || '',
        ...initialValues,
      },
      onSubmit: async ({ value }) => {
        try {
          wizard.saving = true;
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
            const createdDatasourceId = result?.result?.id;
            if (!createdDatasourceId) {
              console.error("Error creating datasource: missing datasource id in response", result);
              return;
            }
            wizard.datasourceId = createdDatasourceId;
          } else {
            const updateResult = await updateDatasource(wizard.datasourceId, finalPayload);
            if (updateResult?.error) {
              console.error("Error updating datasource:", updateResult.error);
              return;
            }
          }
          wizard.nextStep();
        } catch (error) {
          console.error("Error creating datasource:", error);
        } finally {
          wizard.saving = false;
        }
      },
    })
  );

  // Expose submit handler so BottomToolbar can trigger it
  wizard.submitStep = async () => {
    await form.handleSubmit();
  };

  onDestroy(() => {
    wizard.submitStep = null;
  });

  // Derive nextEnabled from form field values
  const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);
  let canProceed = $derived.by(() => {
    const v = formStore?.current?.values;
    return Boolean(
      v?.name?.trim?.() &&
      v?.institutionId &&
      v?.date
    );
  });

  watch(() => canProceed, (enabled) => {
    wizard.nextEnabled = enabled;
  });

  // UI Configuration
  const uiSchema = $derived({
    languageId: { hidden: true },
    templateId: { hidden: true },
    source: { hidden: true },
    importId: { hidden: true },
    name: { label: t("common.datasource-name", { fallback: "Datasource Name" }), colSize: 9, required: true },
   
    institutionId: {
      type: "select",
      label: t("common.institution", { fallback: "Institution" }),
      options: institutions.map((i) => ({ value: i.id, label: i.name.content })),
      colSize: 9,
      required: true,
    },
    date: { type: "date", label: t("common.date", { fallback: "Date" }), colSize: 9, required: true },
     method: { type: "textarea", label: t("common.method", { fallback: "Method" }), colSize: 9 },
    notes: { type: "textarea", label: t("common.notes", { fallback: "Notes" }), colSize: 9 },
    language: { label: t("common.datasource-language", { fallback: "Datasource Language" }), colSize: 9 },
    copyright: { label: t("common.copyright", { fallback: "Copyright" }), colSize: 9 },
    contact: { label: t("common.contact", { fallback: "Contact" }), colSize: 9 },
  });

  const fieldOrder = ["name","institutionId",  "date", "language", "copyright", "contact"];
</script>

<div class="row g-3">
  <!-- Left column: form -->
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
    <div class="bg-white rounded-3 p-4">
      <div>
        <h3 class="mb-1">
          {t("common.add-new-datasource", { fallback: "Add New Datasource" })}
        </h3>
        <p class="mb-0 text-body-secondary">
          {t("common.add-new-datasource-desc", { fallback: "Please fill out the details below to add a new datasource to your project." })}
        </p>
      </div>

      {#if loading}
        <div class="d-flex justify-content-center p-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      {:else}
        <AutoForm
          {form}
          {validator}
          {createFieldValidator}
          {languages}
          translatableFields={TRANSLATABLE_FIELDS}
          {translationsValidator}
          defaultColSize={9}
          {fieldOrder}
          hiddenStaticValues={{ templateId: null }}
          {uiSchema}
          margin={0}
          usePortal={false}
          enableDirtyTracking={false}
        />
      {/if}
    </div>
  </div>

  <!-- Right column: info sidebar -->
  <div class="col-12 col-lg-4 col-xl-3">
    <div class="bg-white border rounded-3 p-4">
      <div class="d-flex flex-column gap-3">
        <div class="flex-shrink-0">
          <IconBulb size={16} stroke={2} />
        </div>
        <div>
          <p class="fw-semibold mb-1 text-body">
            {t("import.datasource-help-title", { fallback: "About the datasource" })}
          </p>
          <div class="text-body-secondary fs-7">
            <p class="mb-2">
              {t("import.datasource-help-description", {
                fallback: "A datasource groups together all the objects you import from a single file or export. Give it a meaningful name — like the institution and year — so you can find it easily later.",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
