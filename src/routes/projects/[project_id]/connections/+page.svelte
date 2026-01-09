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

<div class="container-fluid">
  <div class="row my-3">
    <div class="col-12">
      <h1>{t("project.connections", { fallback: "Connections" })}</h1>
    </div>
  </div>
  <div class="row align-items-center mb-3">
    <div class="col-3">
      <BaseInput
        icon="search"
        placeholder={t("common.search", { fallback: "Search" })}
        clearable
        size="sm"
        bind:value={search}
      />
    </div>
    <div class="col-9 d-flex justify-content-end gap-3 align-items-center">
      <div class="d-flex align-items-center gap-2">
        <a
          class="btn btn-primary btn-sm"
          href="/projects/{data.project.id}/data-structure/research-fields/add?type=vocabulary"
          ><i class="bi bi-plus-lg"></i>
          {t("common.add-field", {
            fallback: "Add Field",
          })}</a
        >
      </div>
    </div>
  </div>

  {#if filteredResearchFields.length > 0}
    <div class="border-bottom mb-3">
      {filteredResearchFields.length}
      {#if filteredResearchFields.length > 1}
        {t("common.connections", { fallback: "connections" })}
      {:else}
        {t("common.connection", { fallback: "connection" })}
      {/if}
      {#if search && search.trim() && filteredResearchFields.length !== data.researchFields.length}
        <span class="text-muted">
          {t("common.of", { fallback: "of" })}
          {data.researchFields.length}
          {t("common.total", { fallback: "total" })}
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
              text={t("common.edit", {
                fallback: "Edit",
              })}
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
              text={t("common.delete", {
                fallback: "Delete",
              })}
            >
              {t("common.delete", {
                fallback: "Delete",
              })}</BaseButton
            >
            <BaseCheckBox
              labelText={t("common.private", {
                fallback: "Private",
              })}
              checked={researchField.private === 1}
              onclick={() =>
                handleCheckboxChange(
                  researchField,
                  "private",
                  researchField.private !== 1,
                )}
            />
            <BaseCheckBox
              labelText={t("common.public-website", {
                fallback: "Public on website",
              })}
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
        {t("common.no-search-results", {
          fallback: "No connections match your search.",
        })}
        <div class="mt-2">
          <button class="btn btn-link btn-sm p-0" onclick={() => (search = "")}>
            {t("common.clear-search", { fallback: "Clear search" })}
          </button>
        </div>
      {:else}
        {t("common.no-connections-found", {
          fallback: "No connections found.",
        })}
      {/if}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<BaseModal bind:isOpen={showDeleteModal}>
  {#snippet header()}
    {t("common.delete-connection", { fallback: "Delete connection" })}
  {/snippet}

  {#snippet body()}
    {#if researchFieldToDelete}
      <p class="mb-3">
        {#if isLoadingCount}
          {t("common.checking-usage", { fallback: "Checking usage..." })}
        {:else if objectsCount > 0}
          <strong>{objectsCount}</strong>
          {#if objectsCount === 1}
            {t("common.object-contains", { fallback: "object contains" })}
          {:else}
            {t("common.objects-contain", { fallback: "objects contain" })}
          {/if}
          <strong>{researchFieldToDelete.name.content}</strong>
          {t("common.values-continue", {
            fallback: "values. Do you want to continue?",
          })}
        {:else}
          {t("common.confirm-delete-connection", {
            fallback: "Are you sure you want to delete the connection",
          })}
          <strong>{researchFieldToDelete.name.content}</strong>?
        {/if}
      </p>
    {/if}
  {/snippet}

  {#snippet actions()}
    <BaseButton
      text={t("common.cancel", { fallback: "Cancel" })}
      class="btn btn-secondary"
      onClick={cancelDelete}
      disabled={isDeleting}
    />
    <BaseButton
      text={isDeleting
        ? t("common.deleting", { fallback: "Deleting..." })
        : t("common.confirm-and-delete", { fallback: "Confirm and delete" })}
      class="btn btn-danger"
      onClick={handleConfirmDelete}
      disabled={isLoadingCount || isDeleting}
    />
  {/snippet}
</BaseModal>
