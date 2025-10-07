<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import DynamicArrayField from "$lib/components/base/DynamicArrayField.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import {
    getValidator,
    createFieldValidator,
    getFormConfig,
  } from "$lib/stores/formValidationUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte.js";
  import {
    createInstitution,
    updateInstitution,
    deleteInstitution,
  } from "$lib/stores/InstitutionsUtils.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { back } from "$lib/utils/navigation.js";

  const { t } = getTranslationStore();

  // Props
  let {
    mode = "create", // "create" or "edit"
    institution = null, // Required for edit mode
    languages = [],
    projectId = null, // Required for create mode
    onSuccess = null, // Optional callback after successful operation
  } = $props();

  // Derived values
  const isEditMode = $derived(mode === "edit");
  const defaultLanguage = $derived(
    languages?.find((lang) => lang.is_default) || languages?.[0],
  );
  const secondaryLanguages = $derived(
    languages?.filter((lang) => !lang.is_default) || [],
  );

  // Translation state - only for translatable fields
  const translatableFields = ["name", "description", "country", "location"];

  // Validator based on mode
  const operationName = $derived(mode === "edit" ? "update" : mode);
  const validator = $derived(getValidator("institutions", operationName));

  // Structured errors storage
  let allValidationErrors = $state([]);
  function setAllValidationErrors(errors) {
    allValidationErrors = errors;
  }

  // Helper functions for edit mode
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
    const direct = fieldObj?.translations?.find(
      (t) => t.language?.code === langCode,
    );
    return direct?.content ?? "";
  }

  function getExistingTranslationId(fieldName, langCode) {
    if (
      !institution ||
      !institution[fieldName] ||
      !institution[fieldName].translations
    ) {
      return null;
    }
    const translation = institution[fieldName].translations.find(
      (t) => t.language?.code === langCode,
    );
    return translation ? translation.id : null;
  }

  // Build default values based on mode
  const defaultValues = $derived.by(() => {
    if (mode === "create") {
      return {
        status: "in progress",
        name: "",
        description: "",
        country: "",
        location: "",
        website: "",
        links: [],
      };
    } else {
      // Edit mode
      const values = {
        id: institution?.id || "",
        name: institution?.name?.content || "",
        description: institution?.description?.content || "",
        country: institution?.country?.content || "",
        location: institution?.location?.content || "",
        status: institution?.status || "in progress",
        website: institution?.website || "",
        links: safeParseLinks(institution?.links || "[]"),
      };

      // Add secondary language translations
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
    }
  });

  // Submit handler
  async function onSubmitForm({ value }) {
    try {
      // Transform links array
      const transformedValue = {
        ...value,
        links:
          value.links?.filter(
            (link) => link.url?.trim() && link.label?.trim(),
          ) || [],
      };

      if (mode === "create") {
        // Create mode
        const result = await createInstitution({
          project_id: projectId || $page.params.project_id,
          languageId: defaultLanguage?.id,
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

        const {
          institution: newInstitution,
          nameId,
          descriptionId,
          countryId,
          locationId,
        } = result;

        // Handle translations for secondary languages
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

        if (onSuccess) {
          onSuccess(newInstitution);
        } else {
          goto(
            `/projects/${projectId || $page.params.project_id}/institutions/${newInstitution.id}`,
          );
        }
      } else {
        // Edit mode
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
            if (nameVal)
              translationPromises.push(
                updateTranslation(nameExistingId, nameVal),
              );
          } else if (nameVal && nameMainId) {
            translationPromises.push(
              addTranslation(nameMainId, langCode, nameVal),
            );
          }

          // Description
          const descVal =
            value[`translations_${lang.id}_description`]?.trim() || "";
          const descMainId = institution.description?.id;
          const descExistingId = getExistingTranslationId(
            "description",
            langCode,
          );
          if (descExistingId) {
            if (descVal)
              translationPromises.push(
                updateTranslation(descExistingId, descVal),
              );
          } else if (descVal && descMainId) {
            translationPromises.push(
              addTranslation(descMainId, langCode, descVal),
            );
          }

          // Country
          const countryVal =
            value[`translations_${lang.id}_country`]?.trim() || "";
          const countryMainId = institution.country?.id;
          const countryExistingId = getExistingTranslationId(
            "country",
            langCode,
          );
          if (countryExistingId) {
            if (countryVal)
              translationPromises.push(
                updateTranslation(countryExistingId, countryVal),
              );
          } else if (countryVal && countryMainId) {
            translationPromises.push(
              addTranslation(countryMainId, langCode, countryVal),
            );
          }

          // Location
          const locationVal =
            value[`translations_${lang.id}_location`]?.trim() || "";
          const locationMainId = institution.location?.id;
          const locationExistingId = getExistingTranslationId(
            "location",
            langCode,
          );
          if (locationExistingId) {
            if (locationVal)
              translationPromises.push(
                updateTranslation(locationExistingId, locationVal),
              );
          } else if (locationVal && locationMainId) {
            translationPromises.push(
              addTranslation(locationMainId, langCode, locationVal),
            );
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

        if (onSuccess) {
          onSuccess(institution);
        }
      }
    } catch (error) {
      console.error(
        `Error ${mode === "create" ? "creating" : "updating"} institution:`,
        error,
      );
      addToast({
        data: {
          title: t("common.error", { fallback: "Error" }),
          description:
            error?.message ||
            `Failed to ${mode === "create" ? "create" : "update"} institution`,
          type: "danger",
        },
      });
    }
  }

  // Create form instance
  const form = $derived(
    createForm(() =>
      getFormConfig("institutions", operationName, {
        defaultValues,
        onSubmit: onSubmitForm,
      }),
    ),
  );

  // UI Schema
  const uiSchema = $derived({
    ...(isEditMode ? { id: { hidden: true } } : {}),
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
      colSize: 7,
    },
    description: {
      type: "textarea",
      label: t("common.description", { fallback: "Description" }),
      colSize: 7,
    },
    country: { label: t("common.country", { fallback: "Country" }) },
    location: { label: t("common.location", { fallback: "Location" }) },
    website: { label: t("common.website", { fallback: "Website" }) },
  });

  // Hidden value providers
  const hiddenValueProviders = $derived({
    ...(isEditMode ? { id: () => institution?.id || "" } : {}),
    project_id: () => projectId || $page.params.project_id,
    languageId: () => defaultLanguage?.id || "",
  });

  // Hidden static values
  const hiddenStaticValues = $derived(
    mode === "create" ? { status: "in progress" } : {},
  );

  // Field order
  const fieldOrder = $derived(
    mode === "create" ? ["website", "links"] : ["links"],
  );

  // Delete Institution Modal state and handlers (only relevant in edit mode)
  let showDeleteModal = $state(false);
  let isDeleting = $state(false);

  function openDeleteModal() {
    if (!isEditMode) return;
    showDeleteModal = true;
  }

  function cancelDelete() {
    showDeleteModal = false;
  }

  async function confirmDeleteInstitution() {
    if (!isEditMode || !institution?.id) {
      showDeleteModal = false;
      return;
    }

    isDeleting = true;
    try {
      const res = await deleteInstitution(institution.id);
      if (res?.error) {
        console.error("Failed to delete institution:", res.error);
      } else {
        // Navigate to project overview page after successful deletion
        goto(`/projects/${projectId || $page.params.project_id}`);
      }
    } catch (err) {
      console.error("Error deleting institution:", err);
    } finally {
      isDeleting = false;
      showDeleteModal = false;
    }
  }
</script>

<form
  onsubmit={(e) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  }}
>
  <div class="min-vh-100 d-flex flex-column">
    <div class="container-fluid flex-grow-1">
      <div class="row">
        <div class="col-12">
          <h2 class="mt-3">
            {isEditMode
              ? t("common.edit-institution", { fallback: "Edit Institution" })
              : t("common.add-new-institution", {
                  fallback: "Add New Institution",
                })}
          </h2>
          {#if !isEditMode}
            <p>
              {t("common.add-new-institution-desc", {
                fallback:
                  "Please fill out the details below to add a new institution to your project.",
              })}
            </p>
          {/if}

          <AutoForm
            {form}
            {validator}
            {createFieldValidator}
            entity={"institutions"}
            operation={operationName}
            {languages}
            {translatableFields}
            setStructuredErrors={setAllValidationErrors}
            defaultColSize={7}
            translationsValidator={getValidator("translations", "create")}
            {fieldOrder}
            {uiSchema}
            {hiddenStaticValues}
            {hiddenValueProviders}
            structuredErrors={allValidationErrors}
          />
        </div>
      </div>
    </div>

    <!-- Sticky bottom action bar -->
    <div
      class="sticky-bottom-bar position-sticky bottom-0 bg-white border-top border-light-subtle mt-auto z-1 flex-shrink-0"
    >
      <div class="container-fluid">
        <div class="row">
          <div class="col-12 d-flex justify-content-end gap-2 p-2">
            {#if isEditMode}
              <BaseButton
                type="button"
                class="btn btn-outline-danger"
                text={t("common.delete", { fallback: "Delete institution" })}
                icon="trash"
                onClick={openDeleteModal}
              />
            {/if}
            <BaseButton
              type="submit"
              class="btn btn-success"
              text={t("common.confirm", { fallback: "Save changes" })}
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Delete Confirmation Modal -->
  {#if showDeleteModal}
    {#snippet header()}
      {t("common.confirm-delete", { fallback: "Confirm Deletion" })}
    {/snippet}

    {#snippet body()}
      <p>
        {t("common.confirm-delete-institution", {
          fallback:
            "Are you sure you want to delete this institution? This action cannot be undone.",
        })}
      </p>
    {/snippet}

    {#snippet actions()}
      <div class="d-flex justify-content-end gap-2">
        <BaseButton
          type="button"
          class="btn btn-secondary"
          text={t("common.cancel", { fallback: "Cancel" })}
          onClick={cancelDelete}
          disabled={isDeleting}
        />
        <BaseButton
          type="button"
          class="btn btn-danger"
          text={isDeleting
            ? t("common.deleting", { fallback: "Deleting..." })
            : t("common.confirm-and-delete", {
                fallback: "Confirm and delete",
              })}
          onClick={confirmDeleteInstitution}
          disabled={isDeleting}
        />
      </div>
    {/snippet}

    <BaseModal
      bind:isOpen={showDeleteModal}
      size="md"
      {header}
      {body}
      {actions}
    />
  {/if}
</form>

<style>
  /* Ensure the form takes full viewport height and allows content to scroll */
  .min-vh-100 {
    min-height: 100vh;
  }

  /* Sticky bottom bar consistent with Project Settings */
  .sticky-bottom-bar {
    position: sticky;
    bottom: 0;
    background-color: white;
    border-top: 1px solid #dee2e6;
    margin-top: auto;
    z-index: 10;
    flex-shrink: 0;
  }
</style>
