<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseLinkedStatus from "$lib/components/base/BaseLinkedStatus.svelte";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import Table from "$lib/components/base/table/Table.svelte";
  import TableImagePreview from "$lib/components/base/table/TableImagePreview.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates.js";
  import { fly } from "svelte/transition";

  let { institution, assets, params = $bindable() } = $props();

  const { t, translationState } = getTranslationStore();

  let viewAs = $state("grid");
  let selectedAssets = $state([]);

  $inspect(selectedAssets);

  const viewAsOptions = $derived([
    { value: "grid", label: t("common.grid-view", { fallback: "Grid" }) },
    { value: "table", label: t("common.table-view", { fallback: "Table" }) },
  ]);

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
      value: "linked",
      label: t("common.linked", { fallback: "Linked" }),
    },
    {
      value: "not_linked",
      label: t("common.not_linked", { fallback: "Not Linked" }),
    },
  ]);

  function clearSelection() {
    selectedAssets = [];
  }
</script>

<div class="w-100">
  <div
    class="row align-items-center mb-3 position-relative overflow-hidden py-2"
  >
    {#if selectedAssets.length > 0}
      <div
        transition:fly={{ opacity: 1, y: -35 }}
        class="d-flex align-items-center px-3 gap-2 position-absolute top-0 start-0 end-0 bottom-0 z-1 bg-white border-bottom"
      >
        <div class="fw-bold">
          {selectedAssets.length}
          {t("common.selected-assets", {
            fallback: "selected assets",
          })}
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" onclick={clearSelection}>
            <i class="bi bi-x-circle"></i>
            {t("common.clear-selection", {
              fallback: "Clear selection",
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
        bind:value={params.aSearch}
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
        <BaseSelect items={statuses} bind:value={params.aLinked} size="sm"
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
        href="/projects/{institution.project_id}/assets/add?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("common.add-asset", { fallback: "Add asset" })}</a
      >
    </div>
  </div>
  {#if assets.items.length > 0}
    {#if viewAs === "grid"}
      <div class="row">
        {#each assets.items as asset (asset.id)}
          <div class="col-3">
            <AssetCard {asset} />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <Table
        items={assets.items}
        columns={[
          {
            value: "image",
            label: null,
            sortable: false,
            accessor: (value) => {
              const src = value.formats?.sm || null;
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
            value: "filename",
            label: t("common.filename", { fallback: "File name" }),
            sortable: true,
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
            value: "linked",
            label: t("common.linked", { fallback: "Linked" }),
            sortable: false,
            accessor: (value) =>
              value.objectsAssets && value.objectsAssets.length > 0,
            render: (value) => ({
              component: BaseLinkedStatus,
              props: { linked: value },
            }),
          },
        ]}
        bind:orderBy={params.aOrderBy}
        bind:direction={params.aDirection}
        bind:selected={selectedAssets}
      />
    {/if}
  {:else if assets.items.length === 0}
    <div class="text-center text-black-50 fs-4 fst-italic mt-4">
      {t("common.no-assets-found", { fallback: "No assets found." })}
    </div>
  {/if}

  {#if assets.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination
          bind:page={params.aPage}
          pageSize={params.pageSize}
          count={assets.totalCount}
          size="sm"
        />
      </div>
    </div>
  {/if}
</div>
