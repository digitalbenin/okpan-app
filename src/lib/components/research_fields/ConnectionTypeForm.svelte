<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseToggle from "$lib/components/base/BaseToggle.svelte";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import { watch } from "runed";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import ConnectionFieldsSelector from "$lib/components/research_fields/ConnectionFieldsSelector.svelte";
  import {
    getValidator,
    createFieldValidator,
    getFormConfig,
  } from "$lib/utils/formValidation.js";
  import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { processEntityTranslations, buildTranslationFormValues } from "$lib/api/TranslationsApi.js";
  import { updateResearchField, deleteResearchField } from "$lib/api/ResearchFieldsApi.js";
  import { DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";
  import { goto } from "$app/navigation";
  import { IconDeviceFloppy, IconTrash, IconArrowLeft } from "@tabler/icons-svelte";

  const translationStore = getTranslationStore();
  const t = $derived(translationStore.t);

  let {
    researchField = null,
    languages = [],
    projectId = null,
    onBack = null,
  } = $props();

  const TRANSLATABLE_FIELDS = ["name", "description"];
  const validator = $derived(getValidator("research_fields", "update"));
  const defaultLanguage = $derived(languages?.find((lang) => lang.is_default) || languages?.[0]);
  const secondaryLanguages = $derived(languages?.filter((lang) => !lang.is_default) || []);

  let autoFormDirtyTracker = $state(null);
  let pageDirtyTracker = $state(null);
  let showDeleteModal = $state(false);
  let isDeleting = $state(false);
  let deleteConfirmationName = $state("");

  const defaultValues = $derived.by(() => ({
    id: researchField?.id || "",
    fieldId: researchField?.id || "",
    name: researchField?.name?.content || "",
    description: researchField?.description?.content || "",
    type: researchField?.type || "vocabulary",
    projectId: projectId || "",
    languageId: defaultLanguage?.id || "",
    vocabularies: [],
    onwebsite: researchField?.onwebsite === 1,
    fieldsConfig: researchField?.fields_config || DEFAULT_FIELDS_CONFIG,
    ...buildTranslationFormValues(researchField, secondaryLanguages, TRANSLATABLE_FIELDS),
  }));

  async function onSubmitForm({ value }) {
    try {
      const payload = {
        type: value.type,
        name: value.name,
        description: value.description,
        onwebsite: value.onwebsite ? 1 : 0,
        fieldsConfig: value.fieldsConfig || value.fields_config,
      };

      await updateResearchField(researchField.id, payload);
      await processEntityTranslations(researchField, secondaryLanguages, TRANSLATABLE_FIELDS, value, languages);
      pageDirtyTracker?.markPristine();
    } catch (error) {
      console.error("Error updating connection type:", error);
    }
  }

  const form = $derived(createForm(() => getFormConfig("research_fields", "update", { defaultValues, onSubmit: onSubmitForm })));
  const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

  watch(
    () => formStore?.current?.values,
    (values) => {
      if (!values) return;
      if (!pageDirtyTracker) {
        pageDirtyTracker = createDirtyTracker({ initialData: values });
      } else {
        pageDirtyTracker.update(values);
      }
    }
  );

  const uiSchema = $derived({
    id: { hidden: true },
    fieldId: { hidden: true },
    type: { hidden: true },
    projectId: { hidden: true },
    languageId: { hidden: true },
    vocabularies: { hidden: true },
    name: {
      label: t("connections.name-of-connection-type", { fallback: "Name of the connection type" }),
      colSize: 9,
      charLimit: 150,
    },
    description: {
      type: "textarea",
      label: t("common.description", { fallback: "Description" }),
      colSize: 9,
      charLimit: 150,
    },
    fieldsConfig: {
      label: t("connections.section.what-fields-included", { fallback: "What fields are included" }),
      renderer: ConnectionFieldsSelector,
      colSize: 12,
    },
    onwebsite: {
      renderer: BaseToggle,
      colSize: 12,
      rendererProps: {
        label: t("common.visibility", { fallback: "Visibility on the website" }),
        labelPosition: "right",
      },
    },
  });

  const hiddenValueProviders = $derived({
    id: () => researchField?.id || "",
    fieldId: () => researchField?.id || "",
    type: () => "vocabulary",
    projectId: () => projectId,
    languageId: () => defaultLanguage?.id || "",
  });

  const connectionDisplayName = $derived(researchField?.name?.content || "");

  const canConfirmDelete = $derived(
    deleteConfirmationName.trim() === connectionDisplayName && !isDeleting
  );

  function openDeleteModal() {
    deleteConfirmationName = "";
    showDeleteModal = true;
  }

  function cancelDelete() {
    deleteConfirmationName = "";
    showDeleteModal = false;
  }

  async function confirmDelete() {
    if (!researchField?.id || deleteConfirmationName.trim() !== connectionDisplayName) {
      return showDeleteModal = false;
    }

    isDeleting = true;
    try {
      const res = await deleteResearchField(researchField.id);
      res?.error ? console.error("Failed to delete connection type:", res.error) : goto(`/projects/${projectId}/connections`);
    } catch (err) {
      console.error("Error deleting connection type:", err);
    } finally {
      isDeleting = false;
      deleteConfirmationName = "";
      showDeleteModal = false;
    }
  }

  const leftActionButtons = $derived.by(() => {
    const buttons = [];

    if (typeof onBack === "function") {
      buttons.push({
        id: "back-connection-type",
        text: t("common.back"),
        iconComponent: IconArrowLeft,
        class: "btn btn-outline-secondary",
        onClick: onBack,
      });
    }

    buttons.push({
      id: "delete-connection-type",
      text: t("common.delete-connection-type", { fallback: "Delete connection type" }),
      class: "btn btn-outline-danger",
      iconComponent: IconTrash,
      onClick: openDeleteModal,
    });

    return buttons;
  });

  const rightActionButtons = $derived([
    {
      id: "save-connection-type",
      text: t("common.save-changes", { fallback: "Save changes" }),
      class: "btn btn-success",
      iconComponent: IconDeviceFloppy,
      type: "submit",
      disableOnError: true,
      disableWhenClean: true,
    },
  ]);
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
    dirtyTracker={pageDirtyTracker}
  >
    <div class="row mb-4 mx-n4 px-0 pb-4 border-bottom">
      <div class="col-12">
        <h2 class="mb-0 px-3">
          {t("project.edit_connection_type", { fallback: "Edit connection type" })}
        </h2>
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
          {uiSchema}
          fieldOrder={["fieldsConfig", "onwebsite"]}
          hiddenValueProviders={hiddenValueProviders}
          hideLanguageSelector={false}
          margin={0}
          bind:dirtyTracker={autoFormDirtyTracker}
        />
      </div>
    </div>
  </PageActionFooter>

  {#if showDeleteModal}
    {#snippet header()}
      {t("common.confirm-delete")}
    {/snippet}

    {#snippet body()}
      <div class="alert alert-danger mb-3" role="alert">
        <div class="fw-semibold mb-1">
          {t("connections.delete-permanently-title", { fallback: "Delete permanently" })}
        </div>
        <div>
          {t("connections.delete-permanently-description", {
            fallback: "This action cannot be undone. All vocabularies and associated data will be permanently removed."
          })}
        </div>
      </div>

      <label for="connection-delete-confirm-name" class="form-label fw-semibold">
        {t("connections.type-name-to-delete", {
          fallback: 'Type the connection type name to confirm deletion',
        })}
      </label>
      <input
        id="connection-delete-confirm-name"
        class="form-control"
        type="text"
        bind:value={deleteConfirmationName}
        placeholder={connectionDisplayName}
        autocomplete="off"
      />
      <div class="form-text">
        {t("connections.type-exact-name-to-delete", {
          fallback: `Type "${connectionDisplayName}" to confirm.`,
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
          onClick={confirmDelete}
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
