<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import ObjectCard from "$lib/components/objects/ObjectCard.svelte";
  import ObjectsTable from "$lib/components/objects/ObjectsTable.svelte";
  import InstitutionObjectsFields from "$lib/components/institutions/InstitutionObjectsFields.svelte";
  import BulkDeleteObjectsModal from "$lib/components/objects/BulkDeleteObjectsModal.svelte";
  import { fly } from "svelte/transition";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { queryParameters, ssp } from "sveltekit-search-params";
  import { updateObjectsStatusBulk } from "$lib/stores/ObjectsUtils.js";

  const { t } = getTranslationStore();

  const { data } = $props();
  const paramsOptions = {
    view: ssp.string("objects"),
    pageSize: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 2,
    },
    page: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    orderBy: ssp.string("updated_at"),
    direction: ssp.string("asc"),
    search: ssp.string(undefined),
    searchField: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: undefined,
    },
    status: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: undefined,
    },
  };
  const params = queryParameters(paramsOptions);

  let paramsBinding = $derived({ current: params }); //workaround for SvelteKit's reactivity issue with query parameters

  let viewAs = $state("grid");
  let selectedObjects = $state([]);
  let bulkStatusValue = $state("");

  // Modal state
  let showBulkDeleteModal = $state(false);

  // Use store utilities for mutations and cache invalidation

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
      ...data.ontologyFields.result.map((field) => ({
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

  // Clear selection after modal emits deleted event
  function handleDeleted() {
    selectedObjects = [];
  }
  async function applyBulkStatus() {
    if (!bulkStatusValue || selectedObjects.length === 0) return;
    const { errors } = await updateObjectsStatusBulk(selectedObjects, bulkStatusValue);
    if (errors && errors.length) {
      console.error("Bulk status update had errors:", errors);
    }
    selectedObjects = [];
    bulkStatusValue = "";
  }
  $inspect(data);
</script>

<div class="container-fluid">
  <div class="row my-3">
    <div class="col-12">
      <h1>
        <i class="bi bi-box"></i>
        {t("common.objects", { fallback: "Objects" })}
      </h1>
    </div>
  </div>
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
        <div>
          <button class="btn btn-secondary btn-sm" onclick={clearSelection}>
            <i class="bi bi-x-circle"></i>
            {t("common.clear-selection", {
              fallback: "Clear selection",
            })}
          </button>
          <button class="btn btn-primary btn-sm">
            {t("common.move-objects", {
              fallback: "Move objects",
            })}
          </button>
          <select
            class="form-select form-select-sm d-inline-block w-auto"
            bind:value={bulkStatusValue}
            onchange={applyBulkStatus}
          >
            <option value="" disabled>{t("common.change-status", { fallback: "Change status" })}</option>
            <option value="completed">{t("common.mark-as-completed", { fallback: "Mark as completed" })}</option>
            <option value="in progress">{t("common.mark-as-in-progress", { fallback: "Mark as in progress" })}</option>
          </select>
          <button class="btn btn-primary btn-sm">
            <i class="bi bi-pencil"></i>
            {t("common.edit-information", {
              fallback: "Edit information",
            })}
          </button>
        </div>
        <div class="ms-auto">
          <button class="btn btn-danger btn-sm" onclick={confirmBulkDelete}>
            <i class="bi bi-trash"></i>
            {t("common.delete", {
              fallback: "Delete",
            })}
          </button>
        </div>
      </div>
    {/if}
    <div class="col-4">
      <BaseInput
        icon="search"
        placeholder={t("common.search", { fallback: "Search" })}
        size="sm"
        bind:value={params.search}
        optionsList={ontologyFieldsList}
        bind:optionsValue={params.searchField}
      />
    </div>
    <div class="col-8 d-flex justify-content-end gap-3 align-items-center">
      <!-- <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.order-by", { fallback: "Order by" })}
        </div>
        <BaseSelect items={orderBy} bind:value={params.orderBy} size="sm"
        ></BaseSelect>
      </div> -->
      <div class="d-flex align-items-center text-truncate gap-2">
        <div class="col-auto fs-7">
          {t("common.select-fields", { fallback: "Select Fields" })}
        </div>
        <InstitutionObjectsFields
          displayFields={data.displayFields}
          researchFields={data.researchFields}
          projectId={data.project.id}
        />
      </div>

      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.status", { fallback: "Status" })}
        </div>
        <BaseSelect items={statuses} bind:value={params.status} size="sm"
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
        href="/projects/{data.project.id}/objects/add"
        ><i class="bi bi-plus-lg"></i>
        {t("common.add-object", { fallback: "Add Object" })}</a
      >
    </div>
  </div>
  {#if data.objects.totalCount}
    <div class="border-bottom mb-3">
      {data.objects.totalCount}
      {#if data.objects.totalCount > 1}
        {t("common.objects", { fallback: "objects" })}
      {:else}
        {t("common.object", { fallback: "object" })}
      {/if}
    </div>
    {#if viewAs === "grid"}
      <div class="row">
        {#each data.objects.items as object (object.id)}
          <div class="col-4">
            <ObjectCard
              {object}
              displayFields={data.displayFields}
              displayInstitution={true}
            />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <ObjectsTable
        items={data.objects.items}
        bind:orderBy={paramsBinding.current.orderBy}
        bind:direction={paramsBinding.current.direction}
        bind:selectedObjects
        displayFields={data.displayFields}
        displayInstitution={true}
      ></ObjectsTable>
    {/if}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {t("common.no-objects-found", {
        fallback: "No objects found.",
      })}
    </div>
  {/if}
  {#if data.objects.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination
          bind:page={params.page}
          pageSize={params.pageSize}
          count={data.objects.totalCount}
          size="sm"
        />
      </div>
    </div>
  {/if}

  <!-- Bulk Delete Confirmation Modal (Reusable Component) -->
  <BulkDeleteObjectsModal
    bind:isOpen={showBulkDeleteModal}
    selectedIds={selectedObjects}
    on:deleted={handleDeleted}
  />
</div>
