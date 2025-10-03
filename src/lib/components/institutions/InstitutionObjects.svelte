<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import ObjectCard from "$lib/components/objects/ObjectCard.svelte";
  import ObjectsTable from "$lib/components/objects/ObjectsTable.svelte";
  import InstitutionObjectsFields from "$lib/components/institutions/InstitutionObjectsFields.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { fly } from "svelte/transition";
  import BulkDeleteObjectsModal from "$lib/components/objects/BulkDeleteObjectsModal.svelte";
  import BulkChangeInstitutionModal from "$lib/components/objects/BulkChangeInstitutionModal.svelte";
  import BulkActionsStatusSelect from "$lib/components/objects/BulkActionsStatusSelect.svelte";
  import { getContext } from "svelte";
  import {
    updateObjectsStatusBulk,
    updateObjectsInstitutionBulk,
  } from "$lib/stores/ObjectsUtils.js";

  let {
    institution,
    objects,
    ontologyFields,
    researchFields,
    displayFields,
    params = $bindable(),
  } = $props();

  const { t, translationState } = getTranslationStore();

  let viewAs = $state("grid");
  let selectedObjects = $state([]);
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);
  let bulkStatusValue = $state("");

  const viewAsOptions = $derived([
    { value: "grid", label: t("common.grid-view", { fallback: "Grid" }) },
    { value: "table", label: t("common.table-view", { fallback: "Table" }) },
  ]);

  const ontologyFieldsList = $derived.by(() => {
    return [
      {
        value: "all",
        label: t("common.all", { fallback: "All" }),
      },
      ...ontologyFields.result.map((field) => ({
        value: field.id,
        label: field.name.content,
      })),
    ];
  });

  const orderBy = $derived([
    // { value: "name", label: t("common.name", { fallback: "Name" }) },
    {
      value: "created_at",
      label: t("common.created-at", { fallback: "Created At" }),
    },
    {
      value: "updated_at",
      label: t("common.updated-at", { fallback: "Updated At" }),
    },
  ]);

  const statuses = $derived([
    {
      value: "all",
      label: t("common.all", { fallback: "All" }),
    },
    {
      value: "in progress",
      label: t("common.in-progress", { fallback: "In progress" }),
    },
    {
      value: "completed",
      label: t("common.completed", { fallback: "Completed" }),
    },
  ]);

  function clearSelection() {
    selectedObjects = [];
  }

  function confirmBulkDelete() {
    showBulkDeleteModal = true;
  }

  function openBulkInstitutionModal() {
    showBulkInstitutionModal = true;
  }

  function handleDeleted() {
    // Clear selection after deletion completes
    selectedObjects = [];
  }

  async function applyBulkStatus() {
    if (!bulkStatusValue || selectedObjects.length === 0) return;
    const { successes, errors } = await updateObjectsStatusBulk(
      selectedObjects,
      bulkStatusValue,
    );
    if (errors && errors.length) {
      console.error("Bulk status update had errors:", errors);
    }

    // Optimistically update local list so changes are visible without refresh
    if (successes && successes.length) {
      const updatedIds = new Set(successes.map((id) => String(id)));
      objects.items = objects.items.map((obj) =>
        updatedIds.has(String(obj.id))
          ? { ...obj, status: bulkStatusValue }
          : obj,
      );

      // If a status filter is active, ensure the view reflects it
      const currentFilter = (params.oStatus || "all").toLowerCase();
      if (currentFilter !== "all") {
        objects.items = objects.items.filter(
          (obj) => (obj.status || "").toLowerCase() === currentFilter,
        );
      }
    }

    selectedObjects = [];
    bulkStatusValue = "";
  }

  async function handleConfirmInstitution({ institutionId }) {
    if (!institutionId || selectedObjects.length === 0) {
      showBulkInstitutionModal = false;
      return;
    }
    const { errors } = await updateObjectsInstitutionBulk(
      selectedObjects,
      institutionId,
    );
    if (errors && errors.length) {
      console.error("Bulk institution update had errors:", errors);
    }
    selectedObjects = [];
    showBulkInstitutionModal = false;
  }

  function openBulkEdit() {
    if (!selectedObjects?.length) return;
    const ids = selectedObjects.map(String).join(",");
    const returnTo = `/projects/${institution.project_id}/institutions/${institution.id}`;
    const url = `/projects/${institution.project_id}/objects/bulk-edit?ids=${encodeURIComponent(ids)}&returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = url;
  }
</script>

<div class="w-100">
  <div
    class="row align-items-center mb-3 position-relative overflow-hidden py-2"
  >
    {#if selectedObjects.length > 0}
      <div
        transition:fly={{ opacity: 1, y: -35 }}
        class="d-flex align-items-center px-3 gap-2 position-absolute top-0 start-0 end-0 bottom-0 z-1 bg-white border-bottom"
      >
        <div class="fw-bold">
          {selectedObjects.length}
          {t("common.selected-objects", {
            fallback: "selected objects",
          })}
        </div>
        <button
          class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
          onclick={clearSelection}
        >
          <span>
            {t("common.clear-selection", { fallback: "Clear selection" })}
          </span>
          <i class="bi bi-x-circle"></i>
        </button>
        <button
          class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
          onclick={openBulkInstitutionModal}
        >
          <span>
            {t("common.change-institution", {
              fallback: "Change institution",
            })}
          </span>
          <i class="bi bi-bank"></i>
        </button>
        <BulkActionsStatusSelect
          items={statuses.filter((s) => s.value !== "all")}
          bind:value={bulkStatusValue}
          onValueChange={applyBulkStatus}
        />
        <button
          class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
          onclick={openBulkEdit}
        >
          <span>
            {t("common.edit-information", {
              fallback: "Edit information",
            })}
          </span>
          <i class="bi bi-pencil"></i>
        </button>
        <div class="ms-auto">
          <button
            class="btn btn-danger btn-sm d-flex align-items-center gap-2"
            onclick={confirmBulkDelete}
          >
            <span>
              {t("common.delete", { fallback: "Delete" })}
            </span>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    {/if}
    <div class="col-4">
      <BaseInput
        icon="search"
        placeholder={t("common.search", { fallback: "Search" })}
        size="sm"
        bind:value={params.oSearch}
        optionsList={ontologyFieldsList}
        bind:optionsValue={params.oSearchField}
      />
    </div>
    <div class="col-8 d-flex justify-content-end gap-3 align-items-center">
      <!-- <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.order-by", { fallback: "Order by" })}
        </div>
        <BaseSelect items={orderBy} bind:value={params.oOrderBy} size="sm"
        ></BaseSelect>
      </div> -->
      <div class="d-flex align-items-center text-truncate gap-2">
        <div class="col-auto fs-7">
          {t("common.select-fields", { fallback: "Select Fields" })}
        </div>
        <InstitutionObjectsFields
          {displayFields}
          {ontologyFields}
          {researchFields}
          projectId={institution.project_id}
        />
      </div>

      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.status", { fallback: "Status" })}
        </div>
        <BaseSelect items={statuses} bind:value={params.oStatus} size="sm"
        ></BaseSelect>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.view-as", { fallback: "View as" })}
        </div>
        <BaseSelect items={viewAsOptions} bind:value={viewAs} size="sm"
        ></BaseSelect>
      </div>
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{institution.project_id}/objects/add?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("common.add-object", { fallback: "Add Object" })}</a
      >
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{institution.project_id}/import?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("common.import-data", { fallback: "Import Data" })}</a
      >
    </div>
  </div>
  {#if objects.items.length > 0}
    {#if viewAs === "grid"}
      <div class="row">
        {#each objects.items as object (object.id)}
          <div class="col-4">
            <ObjectCard {object} {displayFields} />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <ObjectsTable
        items={objects.items}
        bind:orderBy={params.oOrderBy}
        bind:direction={params.oDirection}
        bind:selectedObjects
        {displayFields}
      ></ObjectsTable>
    {/if}
  {:else if objects.items.length === 0}
    <div class="text-center text-black-50 fs-4 fst-italic mt-4">
      {t("common.no-objects-found", { fallback: "No objects found." })}
    </div>
  {/if}

  {#if objects.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination
          bind:page={params.oPage}
          pageSize={params.pageSize}
          count={objects.totalCount}
          size="sm"
        />
      </div>
    </div>
  {/if}
</div>

<!-- Bulk Delete Confirmation Modal (Reusable Component) -->
<BulkDeleteObjectsModal
  bind:isOpen={showBulkDeleteModal}
  selectedIds={selectedObjects}
  on:deleted={handleDeleted}
/>

<!-- Bulk Change Institution Modal (Reusable Component) -->
<BulkChangeInstitutionModal
  bind:isOpen={showBulkInstitutionModal}
  projectId={institution.project_id}
  onConfirm={handleConfirmInstitution}
/>
