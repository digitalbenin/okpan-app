<script>
  import { IconTableOptions, IconSearch, IconCirclePlus, IconPencil, IconMinus, IconX, IconBulb } from "@tabler/icons-svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import ResearchFieldModal from "$lib/components/research_fields/ResearchFieldModal.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    deleteResearchField,
    countObjectsUsingResearchField,
    updateResearchField,
  } from "$lib/api/ResearchFieldsApi.js";
  import { invalidateAll } from "$app/navigation";
  const { data } = $props();
  const { t } = getTranslationStore();

  let search = $state("");
  let showDeleteModal = $state(false);
  let researchFieldToDelete = $state(null);
  let objectsCount = $state(0);
  let isLoadingCount = $state(false);
  let isDeleting = $state(false);

  let fieldModalOpen = $state(false);
  let fieldModalMode = $state("create");
  let fieldModalInitialData = $state(null);
  let fieldModalFixedType = $state(null);

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

  function openAddField(type) {
    fieldModalMode = "create";
    fieldModalInitialData = null;
    fieldModalFixedType = type;
    fieldModalOpen = true;
  }

  function openEditField(field) {
    fieldModalMode = "edit";
    fieldModalInitialData = field;
    fieldModalFixedType = null;
    fieldModalOpen = true;
  }

  function handleFieldSaved() {
    invalidateAll();
  }

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
      }
    } catch (error) {
      console.error(`Error updating ${fieldName}:`, error);
      // TODO: Show error message to user and revert checkbox state
    }
  }
</script>

<!-- Heading section -->
<div class="bg-white border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4">
	<div class="d-flex flex-column gap-3">
		<div class="d-flex align-items-center gap-3">
			<div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
				<IconTableOptions size={32} />
			</div>
			<h1 class="mb-0 flex-grow-1">{t("menu.custom-fields", { fallback: "Custom fields" })}</h1>
		</div>
		<p class="mb-0" style="font-size: 14px;">{t("research-fields.page-description", { fallback: "Define your own text fields to describe objects beyond the default information." })}</p>
	</div>
</div>

<div class="container-fluid py-4">
  <div class="row g-3">
    <div class="col-12 col-lg-8 col-xl-9 min-w-0">
  <div class="bg-white rounded-3 p-4">
    <!-- Control row: search + add button -->
    <div class="d-flex align-items-center justify-content-between pb-3">
      <div class="border rounded-2 d-flex align-items-center px-3 py-1" style="width: 300px;">
        <IconSearch size={16} class="text-body-secondary flex-shrink-0" />
        <input
          type="text"
          class="border-0 form-control form-control-sm bg-transparent"
          placeholder={t("filters.search", { fallback: "Search" })}
          bind:value={search}
        />
        {#if search}
          <button class="btn btn-link text-dark p-0 flex-shrink-0" onclick={() => (search = "")}>
            <IconX size={14} />
          </button>
        {/if}
      </div>
      <button
        class="btn btn-success btn-sm d-flex align-items-center gap-1"
        onclick={() => openAddField("freetext")}
      >
        <IconCirclePlus size={16} />
        {t("export.add-field", { fallback: "Add custom field" })}
      </button>
    </div>

    {#if filteredResearchFields.length > 0}
      <!-- Table header -->
      <div class="d-flex gap-3 align-items-center pb-2 text-body-secondary" style="font-size: 14px;">
        <p class="mb-0 fw-semibold" style="width: 252px;">{t("research-fields.field-name", { fallback: "Field name" })}</p>
        <p class="mb-0 fw-semibold" style="width: 279px;">{t("research-fields.description", { fallback: "Description" })}</p>
        <p class="mb-0 fw-semibold" style="width: 144px;">{t("research-fields.visibility", { fallback: "Visibility on website" })}</p>
        <p class="mb-0 fw-semibold flex-grow-1">{t("research-fields.actions", { fallback: "Actions" })}</p>
      </div>

      <!-- Field rows -->
      {#each filteredResearchFields as researchField (researchField.id)}
        <div class="d-flex gap-3 align-items-start py-3 border-top">
          <p class="mb-0 fw-semibold text-body" style="width: 252px; font-size: 14px;">{researchField.name.content}</p>
          <p class="mb-0 text-body-secondary" style="width: 279px; font-size: 14px;">{researchField.description.content}</p>
          <div class="d-flex flex-column gap-1 justify-content-center" style="width: 144px;">
            <div class="form-check">
              <input
                type="checkbox"
                class="form-check-input"
                id={`onwebsite-${researchField.id}`}
                checked={researchField.onwebsite === 1}
                onchange={() =>
                  handleCheckboxChange(
                    researchField,
                    "onwebsite",
                    researchField.onwebsite !== 1,
                  )}
              />
              <label class="form-check-label" for={`onwebsite-${researchField.id}`}></label>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center">
            <button
              type="button"
              class="btn btn-secondary rounded-circle d-flex align-items-center justify-content-center p-1"
              onclick={() => openEditField(researchField)}
            >
              <IconPencil size={14} />
            </button>
            <button
              type="button"
              class="btn btn-danger rounded-circle d-flex align-items-center justify-content-center p-1"
              onclick={() => confirmDelete(researchField)}
            >
              <IconMinus size={14} />
            </button>
          </div>
        </div>
      {/each}
    {:else}
      <div class="text-center fst-italic text-body-secondary mt-5">
        {#if search && search.trim()}
          {t("common.no-search-results", { fallback: "No results found" })}
        {:else}
          {t("common.no-research-fields-found", { fallback: "No research fields found" })}
        {/if}
      </div>
    {/if}
  </div>
  </div>

    <div class="col-12 col-lg-4 col-xl-3">
      <div class="bg-white border rounded-3 p-4 d-flex flex-column">
        <div class="d-flex flex-column gap-1">
          <div class="flex-shrink-0">
            <IconBulb size={16} stroke={2} />
          </div>
          <div>
            <p class="fw-semibold mb-1 text-body">{t("research-fields.help-title", { fallback: "Custom fields?" })}</p>
            <div class="text-body-secondary fs-7">
              <p class="mb-3">{t("research-fields.help-desc-p1", { fallback: "Custom fields let you define your own text fields to describe objects in ways that go beyond the institution fields and your own connection." })}</p>
            </div>
          </div>
        </div>
        <p class="mb-2 text-body-secondary text-uppercase" style="font-size: 12px; letter-spacing: 0.24px;">{t("research-fields.example-label", { fallback: "Example" })}</p>
        <div class="bg-gray-200 rounded-3 p-3">
          <p class="mb-0 text-body-secondary" style="font-size: 14px;">{t("research-fields.help-example", { fallback: "Okpan already includes a \"Display status\" mapping field to track whether an object is on display or in storage. But your project also needs to record the date the object was first displayed. You add a custom field \"Date on display\"." })}</p>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Delete Confirmation Modal -->
<BaseModal bind:isOpen={showDeleteModal}>
  {#snippet header()}
    {t("common.delete-research-field", { fallback: "Delete research field" })}
  {/snippet}

  {#snippet body()}
    {#if researchFieldToDelete}
      <p class="mb-3">
        {#if isLoadingCount}
          {t("common.checking-usage", { fallback: "Checking usage..." })}
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

<!-- Add/Edit Field Modal -->
<ResearchFieldModal
  bind:open={fieldModalOpen}
  mode={fieldModalMode}
  initialData={fieldModalInitialData}
  fixedType={fieldModalFixedType}
  onSaved={handleFieldSaved}
/>
