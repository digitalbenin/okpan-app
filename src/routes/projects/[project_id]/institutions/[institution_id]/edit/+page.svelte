<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  import {
    getValidator,
    createFieldValidator,
    getFormConfig,
  } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
  import { updateInstitution } from "$lib/stores/InstitutionsUtils.js";

  const { t } = getTranslationStore();

  const { data } = $props();

  // Input data from load function
  let institution = $derived(data.institution);
  let languages = $derived(data.languages);

  const defaultLanguage =
    languages?.find((lang) => lang.is_default) || languages?.[0];
  const secondaryLanguages =
    languages?.filter((lang) => !lang.is_default) || [];

  // Translation state - only for translatable fields
  const translatableFields = ["name", "description", "country", "location"];

  // Validator for update operation
  const validator = getValidator("institutions", "update");

  // Structured errors storage (used by DynamicArrayField for item-level errors)
  let allValidationErrors = $state([]);
  function setAllValidationErrors(errors) {
    allValidationErrors = errors;
  }

  // Helpers for links and translations
  function safeParseLinks(linksData) {
    if (typeof linksData === "string") {
      try {
        const parsed = JSON.parse(linksData);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Failed to parse links JSON string:", e);
        return [];
      }
    } else if (Array.isArray(linksData)) {
      return linksData;
    } else {
      return [];
    }
  }

  function getTranslationContent(fieldObj, langCode) {
    if (!fieldObj) return "";
    // If this language is the original content, prefer content
    const direct = fieldObj?.translations?.find((t) => t.language?.code === langCode);
    return direct?.content ?? "";
  }

  function getExistingTranslationId(fieldName, langCode) {
    if (!institution || !institution[fieldName] || !institution[fieldName].translations) {
      return null;
    }
    const translation = institution[fieldName].translations.find(
      (t) => t.language?.code === langCode,
    );
    return translation ? translation.id : null;
  }

  // Build default values for the form from the current institution
  const defaultValues = (() => {
    const values = {
      // Required hidden input for validator (we still pass id to updateInstitution separately)
      id: institution?.id || "",
      // Default language values mapped to base fields
      name: institution?.name?.content || "",
      description: institution?.description?.content || "",
      country: institution?.country?.content || "",
      location: institution?.location?.content || "",
      status: institution?.status || "in progress",
      website: institution?.website || "",
      links: safeParseLinks(institution?.links || "[]"),
    };

    // Secondary languages -> put into translations_ fields for AutoForm tabs
    for (const lang of secondaryLanguages) {
      const code = lang.code;
      values[`translations_${lang.id}_name`] = getTranslationContent(
        institution?.name,
        code,
      );
      values[`translations_${lang.id}_description`] = getTranslationContent(
        institution?.description,
        code,
      );
      values[`translations_${lang.id}_country`] = getTranslationContent(
        institution?.country,
        code,
      );
      values[`translations_${lang.id}_location`] = getTranslationContent(
        institution?.location,
        code,
      );
    }

    return values;
  })();

  // Submit handler: updates base fields and orchestrates translations like before
  async function onSubmitForm({ value }) {
    try {
      // Transform links array -> filter out empties and serialize to JSON string (as used elsewhere)
      const cleanedLinks = (value.links || []).filter(
        (link) => link.url?.trim() && link.label?.trim(),
      );

      const updatePayload = {
        status: value.status,
        name: value.name,
        description: value.description,
        country: value.country,
        location: value.location,
        website: value.website,
        links: JSON.stringify(cleanedLinks || []),
        languageId: defaultLanguage?.id,
      };

      // Update main fields
      await updateInstitution(institution.id, updatePayload);

      // Handle translations for secondary languages
      const { addTranslation, updateTranslation } = getContentLanguageStore();
      const translationPromises = [];

      for (const lang of secondaryLanguages) {
        const langCode = lang.code;

        // Name
        const nameVal = value[`translations_${lang.id}_name`]?.trim() || "";
        const nameMainId = institution.name?.id;
        const nameExistingId = getExistingTranslationId("name", langCode);
        if (nameExistingId) {
          if (nameVal) translationPromises.push(updateTranslation(nameExistingId, nameVal));
        } else if (nameVal && nameMainId) {
          translationPromises.push(addTranslation(nameMainId, langCode, nameVal));
        }

        // Description
        const descVal = value[`translations_${lang.id}_description`]?.trim() || "";
        const descMainId = institution.description?.id;
        const descExistingId = getExistingTranslationId("description", langCode);
        if (descExistingId) {
          if (descVal) translationPromises.push(updateTranslation(descExistingId, descVal));
        } else if (descVal && descMainId) {
          translationPromises.push(addTranslation(descMainId, langCode, descVal));
        }

        // Country
        const countryVal = value[`translations_${lang.id}_country`]?.trim() || "";
        const countryMainId = institution.country?.id;
        const countryExistingId = getExistingTranslationId("country", langCode);
        if (countryExistingId) {
          if (countryVal) translationPromises.push(updateTranslation(countryExistingId, countryVal));
        } else if (countryVal && countryMainId) {
          translationPromises.push(addTranslation(countryMainId, langCode, countryVal));
        }

        // Location
        const locationVal = value[`translations_${lang.id}_location`]?.trim() || "";
        const locationMainId = institution.location?.id;
        const locationExistingId = getExistingTranslationId("location", langCode);
        if (locationExistingId) {
          if (locationVal)
            translationPromises.push(updateTranslation(locationExistingId, locationVal));
        } else if (locationVal && locationMainId) {
          translationPromises.push(addTranslation(locationMainId, langCode, locationVal));
        }
      }

      if (translationPromises.length > 0) {
        await Promise.all(translationPromises);
      }

      addToast({
        data: {
          title: t("common.success", { fallback: "Success" }),
          description: t("common.institution-updated", {
            fallback: "Institution updated successfully",
          }),
          type: "success",
        },
      });
    } catch (error) {
      console.error("Error updating institution:", error);
      addToast({
        data: {
          title: t("common.error", { fallback: "Error" }),
          description: error?.message || "Failed to update institution",
          type: "danger",
        },
      });
    }
  }

  // Create form instance using getFormConfig with our default values
  const form = createForm(() =>
    getFormConfig("institutions", "update", {
      defaultValues,
      onSubmit: onSubmitForm,
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
          {t("common.edit-institution", { fallback: "Edit Institution" })}
        </h2>

        <AutoForm
          {form}
          {validator}
          {createFieldValidator}
          entity={"institutions"}
          operation={"update"}
          {languages}
          {translatableFields}
          setStructuredErrors={setAllValidationErrors}
          defaultColSize={6}
          translationsValidator={getValidator("translations", "create")}
          fieldOrder={["links"]}
          uiSchema={{
            id: { hidden: true },
            languageId: { hidden: true },
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
                    colSize: 5,
                  },
                  {
                    name: "label",
                    label: "Label",
                    type: "text",
                    placeholder: "Website, Online Catalogue, etc.",
                    required: false,
                    colSize: 5,
                  },
                ],
                addButtonText: "Add Link",
                minItems: 0,
                maxItems: 10,
                structuredErrors: allValidationErrors,
                deleteColSize: 2,
              },
            },
            name: {
              label: t("common.institution-name", { fallback: "Institution Name" }),
              colSize: 6,
            },
            description: {
              type: "textarea",
              label: t("common.description", { fallback: "Description" }),
              colSize: 6,
            },
            country: { label: t("common.country", { fallback: "Country" }) },
            location: { label: t("common.location", { fallback: "Location" }) },
          }}
          hiddenValueProviders={{
            id: () => institution?.id || "",
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
