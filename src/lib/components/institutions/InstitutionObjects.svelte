<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import ObjectCard from "$lib/components/objects/ObjectCard.svelte";
  import Table from "$lib/components/base/table/Table.svelte";
  import TableImagePreview from "$lib/components/base/table/TableImagePreview.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates.js";
  import { fly } from "svelte/transition";

  let { institution, objects, ontologyFields, params = $bindable() } = $props();

  const { t, translationState } = getTranslationStore();

  let viewAs = $state("table");
  let selectedObjects = $state([]);

  $inspect(selectedObjects);

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
          <button class="btn btn-primary btn-sm">
            {t("common.change-status", {
              fallback: "Change status",
            })}
          </button>
          <button class="btn btn-primary btn-sm">
            <i class="bi bi-pencil"></i>
            {t("common.edit-information", {
              fallback: "Edit information",
            })}
          </button>
        </div>
        <div class="ms-auto">
          <button class="btn btn-danger btn-sm">
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
            <ObjectCard {object} />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <Table
        items={objects.items}
        columns={[
          {
            value: "image",
            label: null,
            sortable: false,
            accessor: (value) => {
              const src =
                value.objectsAssets && value.objectsAssets.length > 0
                  ? value.objectsAssets[0].asset.formats.sm
                  : null;
              const id = value.id;
              return {
                src,
                id,
              };
            },
            render: (value) => ({
              component: TableImagePreview,
              props: value,
            }),
          },
          {
            value: "object_id",
            label: t("common.object-id", { fallback: "Object ID" }),
            sortable: false,
            accessor: (value) => {
              return (
                value.objectsOntologyFields?.find(
                  (f) => f.ontologyField.name.content === "object id"
                )?.value || "Id not set"
              );
            },
          },
          {
            value: "created_at",
            label: t("common.created-at", { fallback: "Created At" }),
            sortable: true,
            render: (value) =>
              formatDate(+value, translationState.currentLocale, true),
          },
          {
            value: "updated_at",
            label: t("common.updated-at", { fallback: "Updated At" }),
            sortable: true,
            render: (value) =>
              formatDate(+value, translationState.currentLocale, true),
          },
          {
            value: "status",
            label: t("common.status", { fallback: "Status" }),
            sortable: true,
            render: (value) => ({
              component: BaseBadgeStatus,
              props: { status: value },
            }),
          },
        ]}
        bind:orderBy={params.oOrderBy}
        bind:direction={params.oDirection}
        bind:selected={selectedObjects}
      />
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
