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

  const translationStore = getTranslationStore();
  const contentLanguageStore = getContentLanguageStore();
  const t = $derived(translationStore.t);
  
  // Props
  let { mode = "create", institution = null, languages = [], projectId = null, onSuccess = null } = $props();

  // Constants & Derived
  const TRANSLATABLE_FIELDS = ["name", "description", "country", "location"];
  const isEditMode = $derived(mode === "edit");
  const operationName = $derived(isEditMode ? "update" : "create");
  const validator = $derived(getValidator("institutions", operationName));
  const defaultLanguage = $derived(languages?.find((lang) => lang.is_default) || languages?.[0]);
  const secondaryLanguages = $derived(languages?.filter((lang) => !lang.is_default) || []);
  const currentProjectId = $derived(projectId || $page.params.project_id);

  // State
  let allValidationErrors = $state([]);
  let showDeleteModal = $state(false);
  let isDeleting = $state(false);

  // Helper functions
  const safeParseLinks = (linksData) => {
    if (typeof linksData === "string") {
      try {
        return JSON.parse(linksData);
      } catch (e) {
        return [];
      }
    }
    return Array.isArray(linksData) ? linksData : [];
  };

  // Build default values based on mode
  const defaultValues = $derived.by(() => {
    const baseValues = mode === "create" 
      ? { status: "in progress", name: "", description: "", country: "", location: "", website: "", links: [] }
      : {
          id: institution?.id || "",
          name: institution?.name?.content || "",
          description: institution?.description?.content || "",
          country: institution?.country?.content || "",
          location: institution?.location?.content || "",
          status: institution?.status || "in progress",
          website: institution?.website || "",
          links: safeParseLinks(institution?.links || "[]"),
          ...contentLanguageStore.buildTranslationFormValues(institution, secondaryLanguages, TRANSLATABLE_FIELDS),
        };
    return baseValues;
  });

  // Submit handler
  async function onSubmitForm({ value }) {
    try {
      const cleanedLinks = value.links?.filter((link) => link.url?.trim() && link.label?.trim()) || [];

      if (mode === "create") {
        const result = await createInstitution({
          project_id: currentProjectId,
          languageId: defaultLanguage?.id,
          name: value.name,
          description: value.description,
          country: value.country,
          location: value.location,
          website: value.website,
          links: cleanedLinks,
          status: value.status,
        });

        if (!result?.institution) throw new Error("Failed to create institution");

        const { institution: newInstitution, nameId, descriptionId, countryId, locationId } = result;
        const textIdMap = { name: nameId, description: descriptionId, country: countryId, location: locationId };
        await contentLanguageStore.processEntityTranslations(null, secondaryLanguages, TRANSLATABLE_FIELDS, value, textIdMap);

        onSuccess ? onSuccess(newInstitution) : goto(`/projects/${currentProjectId}/institutions/${newInstitution.id}`);
      } else {
        await updateInstitution(institution.id, {
          status: value.status,
          name: value.name,
          description: value.description,
          country: value.country,
          location: value.location,
          website: value.website,
          links: JSON.stringify(cleanedLinks),
          languageId: defaultLanguage?.id,
        });

        await contentLanguageStore.processEntityTranslations(institution, secondaryLanguages, TRANSLATABLE_FIELDS, value);
        if (onSuccess) onSuccess(institution);
      }
    } catch (error) {
      console.error(`Error ${mode === "create" ? "creating" : "updating"} institution:`, error);
    }
  }

  // Create form instance
  const form = $derived(createForm(() => getFormConfig("institutions", operationName, { defaultValues, onSubmit: onSubmitForm })));

  // UI Schema
  const uiSchema = $derived({
    ...(isEditMode && { id: { hidden: true } }),
    project_id: { hidden: true },
    languageId: { hidden: true },
    status: { hidden: true },
    links: {
      label: t("common.links", { fallback: "Links" }),
      renderer: DynamicArrayField,
      rendererProps: {
        arrayFieldName: "links",
        itemFields: [
          { name: "url", label: "URL", type: "text", placeholder: "https://example.com", required: false, colSize: 5 },
          { name: "label", label: "Label", type: "text", placeholder: "Website, Online Catalogue, etc.", required: false, colSize: 5 },
        ],
        addButtonText: "Add Link",
        minItems: 0,
        maxItems: 10,
        structuredErrors: allValidationErrors,
        deleteColSize: 2,
      },
    },
    name: { label: t("common.institution-name", { fallback: "Institution Name" }), colSize: 7 },
    description: { type: "textarea", label: t("common.description", { fallback: "Description" }), colSize: 7 },
    country: { label: t("common.country", { fallback: "Country" }) },
    location: { label: t("common.location", { fallback: "Location" }) },
    website: { label: t("common.website", { fallback: "Website" }) },
  });

  // Hidden value providers & static values
  const hiddenValueProviders = $derived({
    ...(isEditMode && { id: () => institution?.id || "" }),
    project_id: () => currentProjectId,
    languageId: () => defaultLanguage?.id || "",
  });

  const hiddenStaticValues = $derived(mode === "create" ? { status: "in progress" } : {});
  const fieldOrder = $derived(mode === "create" ? ["website", "links"] : ["links"]);

  // Delete handlers
  const openDeleteModal = () => isEditMode && (showDeleteModal = true);
  const cancelDelete = () => showDeleteModal = false;

  async function confirmDeleteInstitution() {
    if (!isEditMode || !institution?.id) return showDeleteModal = false;

    isDeleting = true;
    try {
      const res = await deleteInstitution(institution.id);
      res?.error ? console.error("Failed to delete institution:", res.error) : goto(`/projects/${currentProjectId}`);
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
            translatableFields={TRANSLATABLE_FIELDS}
            setStructuredErrors={(errors) => allValidationErrors = errors}
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
