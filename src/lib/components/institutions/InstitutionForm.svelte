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
  } from "$lib/utils/formValidation.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { processEntityTranslations, buildTranslationFormValues } from "$lib/api/TranslationsApi.js";
  import {
    createInstitution,
    updateInstitution,
    deleteInstitution,
  } from "$lib/api/InstitutionsApi.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { IconDeviceFloppy, IconTrash, IconArrowLeft, IconComponents } from "@tabler/icons-svelte";

  const translationStore = getTranslationStore();
  const t = $derived(translationStore.t);
  
  // Props
  let { mode = "create", institution = null, languages = [], projectId = null, onSuccess = null, onCancel = null } = $props();

  // Constants & Derived
  const TRANSLATABLE_FIELDS = ["name", "description", "country", "location"];
  const isEditMode = $derived(mode === "edit");
  const operationName = $derived(isEditMode ? "update" : "create");
  const validator = $derived(getValidator("institutions", operationName));
  const defaultLanguage = $derived(languages?.find((lang) => lang.is_default) || languages?.[0]);
  const secondaryLanguages = $derived(languages?.filter((lang) => !lang.is_default) || []);
    const currentProjectId = $derived(projectId || page.params.project_id);

  // State
  let autoFormDirtyTracker = $state(null);
  let showDeleteModal = $state(false);
  let isDeleting = $state(false);
  let deleteConfirmationName = $state("");

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
          ...buildTranslationFormValues(institution, secondaryLanguages, TRANSLATABLE_FIELDS),
        };
    return baseValues;
  });

  // Submit handler
  async function onSubmitForm({ value }) {
    try {
      const cleanedLinks = value.links
        ?.filter((link) => link.url?.trim() && link.label?.trim())
        .map(link => ({ url: link.url, label: link.label }))
        || [];

      const payload = {
        name: value.name,
        description: value.description,
        country: value.country,
        location: value.location,
        website: value.website,
        status: value.status,
      };

      if (mode === "create") {
        const result = await createInstitution({
          project_id: currentProjectId,
          languageId: defaultLanguage?.id,
          links: cleanedLinks,
          ...payload,
        });

        if (!result?.institution) throw new Error("Failed to create institution");

        const { institution: newInstitution, nameId, descriptionId, countryId, locationId } = result;
        const textIdMap = { name: nameId, description: descriptionId, country: countryId, location: locationId };
        await processEntityTranslations(null, secondaryLanguages, TRANSLATABLE_FIELDS, value, languages, textIdMap);

        onSuccess ? onSuccess(newInstitution) : goto(`/projects/${currentProjectId}/institutions/${newInstitution.id}`);
      } else {
        await updateInstitution(institution.id, {
          links: JSON.stringify(cleanedLinks),
          languageId: defaultLanguage?.id,
          ...payload,
        });

        await processEntityTranslations(institution, secondaryLanguages, TRANSLATABLE_FIELDS, value, languages);
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
      colSize: 9
    },
    name: {
      label: t("institutions.institution-name"),
      colSize: 9,
    },
    description: { type: "textarea", label: t("common.description"), colSize: 9 },
    country: { label: t("institutions.country"), colSize: 9 },
    location: { label: t("institutions.location"), colSize: 9 },
    website: { label: t("common.website"), colSize: 9 },
  });

  // Hidden value providers & static values
  const hiddenValueProviders = $derived({
    ...(isEditMode && { id: () => institution?.id || "" }),
    project_id: () => currentProjectId,
    languageId: () => defaultLanguage?.id || "",
  });

  const hiddenStaticValues = $derived(mode === "create" ? { status: "in progress" } : {});
  const fieldOrder = $derived(["website", "links"]);
  const institutionDisplayName = $derived(institution?.name?.content || "");
  const deleteImpactCounts = $derived.by(() => ({
    objects: Number(institution?.objectsCount || 0),
    assets: Number(institution?.assetsCount || 0),
    datasources: Number(institution?.datasourcesCount || 0),
  }));
  const canConfirmDelete = $derived(
    deleteConfirmationName.trim() === institutionDisplayName && !isDeleting
  );

  const leftActionButtons = $derived.by(() => {
    const buttons = [];

    if (typeof onCancel === "function") {
      buttons.push({
        id: "back-institution",
        text: t("common.back"),
        iconComponent: IconArrowLeft,
        class: "btn btn-outline-secondary",
        onClick: onCancel,
      });
    }

    if (isEditMode) {
      buttons.push({
        id: "delete-institution",
        text: t("common.delete"),
        class: "btn btn-outline-danger",
        iconComponent: IconTrash,
        onClick: openDeleteModal,
      });
    }

    return buttons;
  });

  const rightActionButtons = $derived([
    {
      id: "confirm-institution",
      text: t("common.confirm"),
      class: "btn btn-success",
      iconComponent: IconDeviceFloppy,
      type: "submit",
      disableOnError: true,
      disableWhenClean: isEditMode,
    },
  ]);

  // Delete handlers
  const openDeleteModal = () => {
    if (!isEditMode) return;
    deleteConfirmationName = "";
    showDeleteModal = true;
  };
  const cancelDelete = () => {
    deleteConfirmationName = "";
    showDeleteModal = false;
  };

  async function confirmDeleteInstitution() {
    if (!isEditMode || !institution?.id || deleteConfirmationName.trim() !== institutionDisplayName) {
      return showDeleteModal = false;
    }

    isDeleting = true;
    try {
      const res = await deleteInstitution(institution.id);
      res?.error ? console.error("Failed to delete institution:", res.error) : goto(`/projects/${currentProjectId}`);
    } catch (err) {
      console.error("Error deleting institution:", err);
    } finally {
      isDeleting = false;
      deleteConfirmationName = "";
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
    contentClass="container-fluid pb-4"
    leftButtons={leftActionButtons}
    rightButtons={rightActionButtons}
    formStore={formStore}
    dirtyTracker={isEditMode ? autoFormDirtyTracker : null}
  >
    <div class="row mb-4 mx-n4 px-0 pb-4 border-bottom">
      <div class="col-12">
        <h2 class="mb-0 px-3">
          {isEditMode
            ? t("institutions.edit-institution")
            : t("institutions.add-new-institution")}
        </h2>
        {#if !isEditMode}
          <p class="text-muted mt-2 mb-0 px-3">
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
          {languages}
          translatableFields={TRANSLATABLE_FIELDS}
          defaultColSize={7}
          translationsValidator={getValidator("translations", "create")}
          {fieldOrder}
          {uiSchema}
          {hiddenStaticValues}
          {hiddenValueProviders}
          margin={0}
          bind:dirtyTracker={autoFormDirtyTracker}
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
      <div class="alert alert-danger mb-3" role="alert">
        <div class="fw-semibold mb-1">
          {t("institutions.delete-permanently-title")}
        </div>
        <div>
          {t("institutions.delete-permanently-description")}
        </div>
      </div>

      <p class="mb-2">
        {t("institutions.confirm-delete-institution")}
      </p>

      <ul class="mb-3 ps-3">
        <li>
          {deleteImpactCounts.objects}
          {t("institutions.delete-impact-objects")}
        </li>
        <li>
          {deleteImpactCounts.assets}
          {t("institutions.delete-impact-assets")}
        </li>
        <li>
          {deleteImpactCounts.datasources}
          {t("institutions.delete-impact-datasources")}
        </li>
      </ul>

      <label for="institution-delete-confirm-name" class="form-label fw-semibold">
        {t("institutions.type-name-to-delete")}
      </label>
      <input
        id="institution-delete-confirm-name"
        class="form-control"
        type="text"
        bind:value={deleteConfirmationName}
        placeholder={institutionDisplayName}
        autocomplete="off"
      />
      <div class="form-text">
        {t("institutions.type-exact-name-to-delete", {
          name: institutionDisplayName,
        })}
      </div>
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
          disabled={!canConfirmDelete}
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


