<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseCheckBox from "$lib/components/base/BaseCheckBox.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseBadge from "$lib/components/base/BaseBadge.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    deleteResearchField,
    countObjectsUsingResearchField,
    updateResearchField,
  } from "$lib/stores/ResearchFieldsUtils.js";
  import { invalidateAll } from "$app/navigation";
  import { goto } from "$app/navigation";
  const { data } = $props();
  const { t } = getTranslationStore();

  let search = $state("");
  let showDeleteModal = $state(false);
  let researchFieldToDelete = $state(null);
  let objectsCount = $state(0);
  let isLoadingCount = $state(false);
  let isDeleting = $state(false);

  // Filter research fields based on search input
  const filteredResearchFields = $derived.by(() => {
    if (!search || !search.trim()) {
      return data.researchFields || [];
    }

    const searchTerm = search.toLowerCase().trim();
    return (data.researchFields || []).filter(
      (field) =>
        field.name?.content?.toLowerCase().includes(searchTerm) ||
        field.description?.content?.toLowerCase().includes(searchTerm),
    );
  });

  // Function to open the delete confirmation modal
  async function confirmDelete(researchField) {
    researchFieldToDelete = researchField;
    isLoadingCount = true;
    showDeleteModal = true;

    // Get the count of objects using this research field
    const { result, error } = await countObjectsUsingResearchField(
      researchField.id,
    );
    isLoadingCount = false;

    if (error) {
      console.error("Error counting objects:", error);
      objectsCount = 0;
    } else {
      objectsCount = result;
    }
  }

  // Function to handle the actual deletion after confirmation
  async function handleConfirmDelete() {
    if (!researchFieldToDelete) return;

    isDeleting = true;
    const { result, error } = await deleteResearchField(
      researchFieldToDelete.id,
    );

    if (error) {
      console.error("Error deleting research field:", error);
      // TODO: Show error message to user
    } else {
      console.log("Research field deleted successfully");
      // Refresh the data
      await invalidateAll();
    }

    isDeleting = false;
    showDeleteModal = false;
    researchFieldToDelete = null;
    objectsCount = 0;
  }

  // Function to cancel deletion
  function cancelDelete() {
    showDeleteModal = false;
    researchFieldToDelete = null;
    objectsCount = 0;
    isLoadingCount = false;
  }

  // Function to handle checkbox changes
  async function handleCheckboxChange(researchField, fieldName, newValue) {
    try {
      const updateData = {
        [fieldName]: newValue,
      };

      const { result, error } = await updateResearchField(
        researchField.id,
        updateData,
      );

      if (error) {
        console.error(`Error updating ${fieldName}:`, error);
        // TODO: Show error message to user and revert checkbox state
      } else {
        // Update the local data to reflect the change
        const fieldIndex = data.researchFields.findIndex(
          (f) => f.id === researchField.id,
        );
        if (fieldIndex !== -1) {
          data.researchFields[fieldIndex][fieldName] = newValue ? 1 : 0;
        }
      }
    } catch (error) {
      console.error(`Error updating ${fieldName}:`, error);
      // TODO: Show error message to user and revert checkbox state
    }
  }
</script>

<div class="container-fluid py-4">
  <div class="row mb-4">
    <div class="col-12">
      <h1 class="h3 mb-0">{t("filters.research-fields")}</h1>
    </div>
  </div>
  <div class="row align-items-center mb-3">
    <div class="col-3">
      <BaseInput
        icon="search"
        placeholder={t("filters.search")}
        clearable
        size="sm"
        bind:value={search}
      />
    </div>
    <div class="col-9 d-flex justify-content-end gap-3 align-items-center">
      <div class="d-flex align-items-center gap-2">
        <a
          class="btn btn-primary btn-sm"
          href="/projects/{data.project.id}/data-structure/research-fields/add?type=freetext"
          ><i class="bi bi-plus-lg"></i>
          {t("export.add-field")}</a
        >
      </div>
    </div>
  </div>

  {#if filteredResearchFields.length > 0}
    <div class="border-bottom mb-3">
      {filteredResearchFields.length}
      {t("filters.research-fields")}
      {#if search && search.trim() && filteredResearchFields.length !== data.researchFields.length}
        <span class="text-muted">
          {t("common.of")}
          {data.researchFields.length}
          {t("common.total")}
        </span>
      {/if}
    </div>
    {#each filteredResearchFields as researchField (researchField.id)}
      <div class="d-flex py-2 border-bottom">
        <div class="col-3">
          <BaseBadge
            class="bg-secondary-subtle text-dark"
            value={researchField.name.content}
          ></BaseBadge>
        </div>
        <div class="col-6">
          {researchField.description.content}
        </div>
        <div class="col-3">
          <div class="d-flex flex-column align-items-start gap-2">
            <BaseButton
              class="btn btn-sm btn-link text-dark p-0 text-decoration-none"
              icon="pencil"
              text={t("common.edit")}
              onClick={() => {
                console.log("Editing research field:", researchField);
                goto(
                  `/projects/${data.project.id}/data-structure/research-fields/${researchField.id}`,
                );
              }}
            ></BaseButton>
            <BaseButton
              class="btn btn-link text-danger p-0 text-decoration-none"
              onClick={() => confirmDelete(researchField)}
              icon="trash"
              text={t("common.delete")}
            >
              {t("common.delete")}</BaseButton
            >
            <BaseCheckBox
              labelText={t("common.private")}
              checked={researchField.private === 1}
              onclick={() =>
                handleCheckboxChange(
                  researchField,
                  "private",
                  researchField.private !== 1,
                )}
            />
            <BaseCheckBox
              labelText={t("common.public-website")}
              checked={researchField.onwebsite === 1}
              onclick={() =>
                handleCheckboxChange(
                  researchField,
                  "onwebsite",
                  researchField.onwebsite !== 1,
                )}
            />
          </div>
        </div>
      </div>
    {/each}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {#if search && search.trim()}
        {t("common.no-search-results")}
        <div class="mt-2">
          <button class="btn btn-link btn-sm p-0" onclick={() => (search = "")}>
            {t("common.clear-search")}
          </button>
        </div>
      {:else}
        {t("common.no-research-fields-found")}
      {/if}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<BaseModal bind:isOpen={showDeleteModal}>
  {#snippet header()}
    {t("common.delete-research-field")}
  {/snippet}

  {#snippet body()}
    {#if researchFieldToDelete}
      <p class="mb-3">
        {#if isLoadingCount}
          {t("common.checking-usage")}
        {:else if objectsCount > 0}
          {t("common.research-field-usage-warning", {
            count: objectsCount,
            name: researchFieldToDelete.name.content,
          })}
        {:else}
          {t("common.confirm-delete-research-field", {
            name: researchFieldToDelete.name.content,
          })}
        {/if}
      </p>
    {/if}
  {/snippet}

  {#snippet actions()}
    <BaseButton
      text={t("common.cancel")}
      class="btn btn-secondary"
      onClick={cancelDelete}
      disabled={isDeleting}
    />
    <BaseButton
      text={isDeleting
        ? t("common.deleting")
        : t("common.confirm-and-delete")}
      class="btn btn-danger"
      onClick={handleConfirmDelete}
      disabled={isLoadingCount || isDeleting}
    />
  {/snippet}
</BaseModal>
