<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import {
    getValidator,
    createFieldValidator,
    getFormConfig,
  } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    createDatasource,
    updateDatasource,
  } from "$lib/stores/DatasourcesUtils.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import AutoForm from "$lib/components/form/AutoForm.svelte";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  // Extract data from props
  const { institutions, languages, templates } = $props();
  const defaultLanguage =
    languages?.find((lang) => lang.is_default) || languages?.[0];

  // Translation state - used by AutoForm
  const translatableFields = ["name", "method", "notes"];

  const validator = getValidator("datasources", "create");
  const translationsValidator = getValidator("translations", "create");

  // Store all validation errors for components to use
  let allValidationErrors = $state([]);

  function setAllValidationErrors(errors) {
    allValidationErrors = errors;
  }

  // Create the form using optimized config (live validation via onChange)
  const form = createForm(() =>
    getFormConfig("datasources", "create", {
      defaultValues: {
        date: new Date().toISOString(),
      },
      onSubmit: async ({ value }) => {
        try {
          const { templateId, ...rest } = value || {};

          // Extract translations typed in multilingual tabs
          const nameTranslations = [];
          const methodTranslations = [];
          const notesTranslations = [];

          for (const lang of languages || []) {
            if (!lang.is_default) {
              const nameKey = `translations_${lang.id}_name`;
              const methodKey = `translations_${lang.id}_method`;
              const notesKey = `translations_${lang.id}_notes`;

              if (rest[nameKey]) {
                nameTranslations.push({
                  language_code: lang.code,
                  content: rest[nameKey],
                });
              }
              if (rest[methodKey]) {
                methodTranslations.push({
                  language_code: lang.code,
                  content: rest[methodKey],
                });
              }
              if (rest[notesKey]) {
                notesTranslations.push({
                  language_code: lang.code,
                  content: rest[notesKey],
                });
              }
            }
          }

          // Clean the payload by removing translation temp fields
          const payload = { ...rest };
          for (const key of Object.keys(payload)) {
            if (key.startsWith("translations_")) delete payload[key];
          }

          if (!wizard.datasourceId) {
            const result = await createDatasource({
              ...payload,
              nameTranslations: nameTranslations.length
                ? nameTranslations
                : undefined,
              methodTranslations: methodTranslations.length
                ? methodTranslations
                : undefined,
              notesTranslations: notesTranslations.length
                ? notesTranslations
                : undefined,
            });
            if (result?.error) {
              console.error("Error creating datasource:", result.error);
              return;
            }
            wizard.datasourceId = result.result[0].id;
            wizard.nextEnabled = true;
          } else {
            const updateResult = await updateDatasource(wizard.datasourceId, {
              ...payload,
              nameTranslations: nameTranslations.length
                ? nameTranslations
                : undefined,
              methodTranslations: methodTranslations.length
                ? methodTranslations
                : undefined,
              notesTranslations: notesTranslations.length
                ? notesTranslations
                : undefined,
            });
            if (updateResult?.error) {
              console.error("Error updating datasource:", updateResult.error);
              return;
            }
            wizard.nextEnabled = true;
          }
        } catch (error) {
          console.error("Error creating datasource:", error);
        }
      },
    }),
  );
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  }}
>
  <div class="container-fluid">
    <div class="row">
      <div class="col-12">
        <h2 class="mt-3">
          {t("common.add-new-datasource", { fallback: "Add New Datasource" })}
        </h2>
        <p>
          {t("common.add-new-datasource-desc", {
            fallback:
              "Please fill out the details below to add a new datasource to your project.",
          })}
        </p>
      </div>
    </div>

    <div class="row">
      <div class="col-12">
        <AutoForm
          {form}
          {validator}
          {createFieldValidator}
          entity={"datasources"}
          operation={"create"}
          {languages}
          {translatableFields}
          {translationsValidator}
          setStructuredErrors={setAllValidationErrors}
          defaultColSize={6}
          fieldOrder={[
            "institutionId",
            "date",
            "language",
            "copyright",
            "contact",
          ]}
          hiddenStaticValues={{ templateId: null }}
          uiSchema={{
            languageId: { hidden: true },
            templateId: { hidden: true },
            name: {
              label: t("common.datasource-name", {
                fallback: "Datasource Name",
              }),
              colSize: 6,
            },
            method: {
              type: "textarea",
              label: t("common.method", { fallback: "Method" }),
              colSize: 6,
            },
            notes: {
              type: "textarea",
              label: t("common.notes", { fallback: "Notes" }),
              colSize: 6,
            },
            institutionId: {
              type: "select",
              label: t("common.institution", { fallback: "Institution" }),
              options: institutions.map((i) => ({
                value: i.id,
                label: i.name.content,
              })),
              colSize: 6,
            },
            date: {
              type: "date",
              label: t("common.date", { fallback: "Date" }),
              colSize: 6,
            },
            language: {
              label: t("common.datasource-language", {
                fallback: "Datasource Language",
              }),
              colSize: 6,
            },
            copyright: {
              label: t("common.copyright", { fallback: "Copyright" }),
              colSize: 6,
            },
            contact: {
              label: t("common.contact", { fallback: "Contact" }),
              colSize: 6,
            },
          }}
        />
      </div>
    </div>

    <div class="row mt-4">
      <div class="col-12">
        <BaseButton
          type="submit"
          class="btn btn-success"
          text={t("common.confirm", { fallback: "Confirm" })}
        />
      </div>
    </div>
  </div>
</form>
