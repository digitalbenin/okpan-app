<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import {
    getValidator,
    createFieldValidator,
  } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { page } from "$app/stores";
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  import { createInstitution } from "$lib/stores/InstitutionsUtils.js";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
  import { goto } from "$app/navigation";
  import AutoForm from "$lib/components/form/AutoForm.svelte";

  const { t } = getTranslationStore();

  let { data } = $props();

  // Extract languages from layout data
  const { languages } = data;
  const defaultLanguage =
    languages?.find((lang) => lang.is_default) || languages?.[0];
  const secondaryLanguages =
    languages?.filter((lang) => !lang.is_default) || [];

  // Translation state - only for translatable fields
  const translatableFields = ["name", "description", "country", "location"];

  // Make sure custom validators (like links) are merged into schema
  const validator = getValidator("institutions", "create");

  // Create default values including translation fields
  const createDefaultValues = () => {
    const defaults = {
      project_id: $page.params.project_id,
      languageId: defaultLanguage?.id || "",
      name: "",
      description: "",
      country: "",
      location: "",
      website: "",
      status: "in progress",
      links: [{ url: "", label: "" }],
    };

    // Add translation fields for each secondary language
    secondaryLanguages.forEach((lang) => {
      translatableFields.forEach((field) => {
        defaults[`translations_${lang.id}_${field}`] = "";
      });
    });

    return defaults;
  };

  // Store all validation errors for components to use
  let allValidationErrors = $state([]);

  // Helper function to set structured errors
  function setAllValidationErrors(errors) {
    allValidationErrors = errors;
  }

  // Create form instance
  const form = createForm(() => ({
    defaultValues: createDefaultValues(),
    validators: {
      onSubmit: ({ value }) => {
        const result = validator.schema.safeParse(value);
        if (!result.success) {
          // Store ALL validation errors for components
          allValidationErrors = result.error.errors;

          const fieldErrors = {};
          result.error.errors.forEach((error) => {
            const fieldPath = error.path.join(".");
            if (!fieldErrors[fieldPath]) {
              fieldErrors[fieldPath] = [];
            }
            fieldErrors[fieldPath].push(error.message);
          });
          return { fields: fieldErrors };
        } else {
          allValidationErrors = [];
        }
        return undefined;
      },
    },
    onSubmit: async ({ value }) => {
      try {
        // Transform links array to native array for the mutation
        const transformedValue = {
          ...value,
          links:
            value.links?.filter(
              (link) => link.url?.trim() && link.label?.trim(),
            ) || [],
        };

        // Create the institution (real call)
        const result = await createInstitution({
          project_id: transformedValue.project_id,
          languageId: transformedValue.languageId,
          name: transformedValue.name,
          description: transformedValue.description,
          country: transformedValue.country,
          location: transformedValue.location,
          website: transformedValue.website,
          links: transformedValue.links,
          status: transformedValue.status,
        });

        if (!result || !result.institution) {
          console.error("createInstitution result:", result);
          throw new Error("Failed to create institution");
        }

        const { institution, nameId, descriptionId, countryId, locationId } =
          result;

        // Prepare translation creation promises
        const contentLanguageStore = getContentLanguageStore();
        const translationFieldToTextId = {
          name: nameId,
          description: descriptionId,
          country: countryId,
          location: locationId,
        };

        const translationPromises = [];
        for (const lang of secondaryLanguages) {
          for (const fieldName of translatableFields) {
            const translationFieldKey = `translations_${lang.id}_${fieldName}`;
            const content = transformedValue[translationFieldKey];

            if (content?.trim() && translationFieldToTextId[fieldName]) {
              translationPromises.push(
                contentLanguageStore
                  .addTranslation(
                    translationFieldToTextId[fieldName],
                    lang.code,
                    content,
                  )
                  .catch((err) => {
                    throw err;
                  }),
              );
            }
          }
        }
        await Promise.all(translationPromises);

        goto(
          `/projects/${transformedValue.project_id}/institutions/${institution.id}`,
        );
      } catch (error) {
        console.error("Error creating institution:", error);
      }
    },
  }));
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
          {t("common.add-new-institution", { fallback: "Add New Institution" })}
        </h2>
        <p>
          {t("common.add-new-institution-desc", {
            fallback:
              "Please fill out the details below to add a new institution to your project.",
          })}
        </p>

        <AutoForm
          {form}
          {validator}
          {createFieldValidator}
          entity={"institutions"}
          operation={"create"}
          {languages}
          {translatableFields}
          setStructuredErrors={setAllValidationErrors}
          defaultColSize={6}
          translationsValidator={getValidator("translations", "create")}
          fieldOrder={["website", "links"]}
          uiSchema={{
            project_id: { hidden: true },
            languageId: { hidden: true },
            status: { hidden: true },
            links: {
              label: t("common.links", { fallback: "Links" }),
              renderer: DynamicArrayField,
              rendererProps: {
                arrayFieldName: "links",
                itemFields: [
                  {
                    name: "url",
                    label: "URL",
                    type: "text",
                    placeholder: "https://example.com",
                    required: false,
                    colSize: 6,
                  },
                  {
                    name: "label",
                    label: "Label",
                    type: "text",
                    placeholder: "Website, Online Catalogue, etc.",
                    required: false,
                    colSize: 6,
                  },
                ],
                addButtonText: "Add Link",
                minItems: 0,
                maxItems: 10,
                structuredErrors: allValidationErrors,
              },
            },
            name: {
              label: t("common.institution-name", {
                fallback: "Institution Name",
              }),
              colSize: 6,
            },
            description: {
              type: "textarea",
              label: t("common.description", { fallback: "Description" }),
              colSize: 6,
            },
            country: { label: t("common.country", { fallback: "Country" }) },
            location: { label: t("common.location", { fallback: "Location" }) },
            website: { label: t("common.website", { fallback: "Website" }) },
          }}
          hiddenStaticValues={{ status: "in progress" }}
          hiddenValueProviders={{
            project_id: () => $page.params.project_id,
            languageId: () => defaultLanguage?.id || "",
          }}
          structuredErrors={allValidationErrors}
        />
      </div>
    </div>
  </div>

  <div
    class="position-absolute bottom-0 start-0 w-100 bg-light z-1 p-3 d-flex justify-content-end"
  >
    <BaseButton
      type="submit"
      class="btn btn-success"
      text={t("common.confirm", { fallback: "Confirm" })}
    />
  </div>
</form>
