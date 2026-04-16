<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
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
  const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

  // UI Schema
  const uiSchema = $derived({
    ...(isEditMode && { id: { hidden: true } }),
    project_id: { hidden: true },
    languageId: { hidden: true },
    status: { hidden: true },
    links: {
      label: t("institutions.links"),
      renderer: DynamicArrayField,
      rendererProps: {
        arrayFieldName: "links",
        itemFields: [
          {
            name: "url",
            label: t("institutions.url"),
            type: "text",
            placeholder: t("institutions.url-placeholder"),
            required: false,
            colSize: 5,
          },
          {
            name: "label",
            label: t("common.label"),
            type: "text",
            placeholder: t("institutions.link-label-placeholder"),
            required: false,
            colSize: 5,
          },
        ],
        addButtonText: t("institutions.add-link"),
        deleteButtonTitle: t("institutions.remove-link"),
        minItems: 0,
        maxItems: 10,
        deleteColSize: 2,
      },
    },
    name: {
      label: t("institutions.institution-name"),
      colSize: 7,
    },
    description: { type: "textarea", label: t("common.description"), colSize: 7 },
    country: { label: t("institutions.country") },
    location: { label: t("institutions.location") },
    website: { label: t("common.website") },
  });

  // Hidden value providers & static values
  const hiddenValueProviders = $derived({
    ...(isEditMode && { id: () => institution?.id || "" }),
    project_id: () => currentProjectId,
    languageId: () => defaultLanguage?.id || "",
  });

  const hiddenStaticValues = $derived(mode === "create" ? { status: "in progress" } : {});
  const fieldOrder = $derived(mode === "create" ? ["website", "links"] : ["links"]);

  const leftActionButtons = $derived(isEditMode
    ? [{
        id: "delete-institution",
        text: t("common.delete"),
        class: "btn btn-outline-danger",
        icon: "trash",
        onClick: openDeleteModal,
      }]
    : []);

  const rightActionButtons = $derived([
    {
      id: "confirm-institution",
      text: t("common.confirm"),
      class: "btn btn-success",
      type: "submit",
      disableOnError: true,
    },
  ]);

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
  <PageActionFooter
    contentClass="container-fluid py-4"
    leftButtons={leftActionButtons}
    rightButtons={rightActionButtons}
    formStore={formStore}
  >
    <div class="row mb-4">
      <div class="col-12">
        <h1 class="h3 mb-0">
          {isEditMode
            ? t("institutions.edit-institution")
            : t("institutions.add-new-institution")}
        </h1>
        {#if !isEditMode}
          <p class="text-muted mt-2 mb-0">
            {t("institutions.add-new-institution-desc")}
          </p>
        {/if}
      </div>
    </div>

    <div class="row">
      <div class="col-12">
        <AutoForm
          {form}
          {validator}
          {createFieldValidator}
          entity={"institutions"}
          operation={operationName}
          {languages}
          translatableFields={TRANSLATABLE_FIELDS}
          defaultColSize={7}
          translationsValidator={getValidator("translations", "create")}
          {fieldOrder}
          {uiSchema}
          {hiddenStaticValues}
          {hiddenValueProviders}
        />
      </div>
    </div>
  </PageActionFooter>

  <!-- Delete Confirmation Modal -->
  {#if showDeleteModal}
    {#snippet header()}
      {t("common.confirm-delete")}
    {/snippet}

    {#snippet body()}
      <p>
        {t("institutions.confirm-delete-institution")}
      </p>
    {/snippet}

    {#snippet actions()}
      <div class="d-flex justify-content-end gap-2">
        <BaseButton
          type="button"
          class="btn btn-secondary"
          text={t("common.cancel")}
          onClick={cancelDelete}
          disabled={isDeleting}
        />
        <BaseButton
          type="button"
          class="btn btn-danger"
          text={isDeleting
            ? t("common.deleting")
            : t("common.confirm-and-delete")}
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


