<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseLinkedStatus from "$lib/components/base/BaseLinkedStatus.svelte";
  import AssetCard from "$lib/components/assets/AssetCard.svelte";
  import BulkDeleteAssetsModal from "$lib/components/assets/BulkDeleteAssetsModal.svelte";
  import LinkObjectsModal from "$lib/components/assets/LinkObjectsModal.svelte";
  import { linkAssetsToObjectsBulk } from "$lib/stores/ObjectsUtils.js";
  import Table from "$lib/components/base/table/Table.svelte";
  import TableImagePreview from "$lib/components/base/table/TableImagePreview.svelte";
  import TableLink from "$lib/components/base/table/TableLink.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates.js";
  import { fly } from "svelte/transition";

  let { institution, assets, params = $bindable() } = $props();
  const { t, translationState } = getTranslationStore();

  let viewAs = $state("grid");
  import { getContext } from "svelte";
  const assetsCtx = getContext("institutionAssetsSelection");
  let selectedAssets = $state([]);
  let isDeleteModalOpen = $state(false);
  let isLinkModalOpen = $state(false);
  let linkAssetId = $state(null);

  const viewAsOptions = $derived([
    { value: "grid", label: t("common.grid-view") },
    { value: "table", label: t("common.table-view") },
  ]);

  const orderBy = $derived([
    // { value: "name", label: t("common.name", { fallback: "Name" }) },
    {
      value: "created_at",
      label: t("common.created-at"),
    },
    {
      value: "updated_at",
      label: t("common.updated-at"),
    },
  ]);

  const statuses = $derived([
    {
      value: "all",
      label: t("common.all"),
    },
    {
      value: "linked",
      label: t("common.linked"),
    },
    {
      value: "not_linked",
      label: t("common.not-linked"),
    },
  ]);

  // Display-level filtering to respect status while backend schema updates propagate
  const filteredItems = $derived.by(() => {
    const status = params?.aLinked;
    if (status === "linked") {
      return (assets.items || []).filter(
        (a) => Array.isArray(a.objectsAssets) && a.objectsAssets.length > 0,
      );
    }
    if (status === "not_linked") {
      return (assets.items || []).filter(
        (a) => !Array.isArray(a.objectsAssets) || a.objectsAssets.length === 0,
      );
    }
    return assets.items || [];
  });

  function clearSelection() {
    selectedAssets = [];
  }

  function openDeleteModal() {
    if (selectedAssets.length === 0) return;
    isDeleteModalOpen = true;
  }

  function openLinkModal() {
    if (selectedAssets.length === 0) return;
    linkAssetId = String(selectedAssets[0]);
    isLinkModalOpen = true;
  }
  import { goto } from "$app/navigation";
  function openBulkEdit() {
    if (selectedAssets.length === 0) return;
    assetsCtx?.setSelected?.(selectedAssets.map(String));
    goto(`/projects/${institution.project_id}/institutions/${institution.id}/assets/bulk-edit`);
  }

  async function handleModalLinked(payload) {
    try {
      // Modal currently sends an array of linked object results; support both shapes
      const isArrayPayload = Array.isArray(payload);
      const extractedIds = isArrayPayload
        ? (payload || []).map((obj) => String(obj?.id)).filter(Boolean)
        : payload?.objectIds || [];
      const assetId = isArrayPayload
        ? linkAssetId
        : (payload?.assetId ?? linkAssetId);
      const objectIds = extractedIds;
      const allAssetIds = selectedAssets.map(String);
      // Ensure first asset is included in bulk operation as well
      if (assetId && !allAssetIds.includes(String(assetId))) {
        allAssetIds.push(String(assetId));
      }
      await linkAssetsToObjectsBulk(allAssetIds, objectIds);
    } finally {
      isLinkModalOpen = false;
      clearSelection();
    }
  }

  function handleBulkDeleted(event) {
    // The store action triggers invalidate('app:assets'), so the page will reload.
    // We just need to close the modal and clear selection.
    isDeleteModalOpen = false;
    clearSelection();
  }
</script>

<div class="w-100 mb-3">
  <div
    class="row align-items-center mb-3 position-relative overflow-hidden py-2"
  >
    {#if selectedAssets.length > 0}
      <div
        transition:fly={{ opacity: 1, y: -35 }}
        class="d-flex align-items-center px-3 gap-2 position-absolute top-0 start-0 end-0 bottom-0 z-1 bg-white border-bottom"
      >
        <div>
          <button
            class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
            onclick={clearSelection}
          >
            <span>
              {t("common.clear-selection")}
            </span>
            <i class="bi bi-x-circle"></i>
          </button>
        </div>
        <div>
          <button
            class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
            onclick={openLinkModal}
          >
            <span>
              {t("common.link-to-object")}
            </span>
            <i class="bi bi-link-45deg"></i>
          </button>
        </div>
        <div>
          <button
            class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
            onclick={openBulkEdit}
          >
            <span>
              {t("common.edit-metadata")}
            </span>
            <i class="bi bi-pencil-square"></i>
          </button>
        </div>
        <div class="ms-auto">
          <button
            class="btn btn-danger btn-sm d-flex align-items-center gap-2"
            onclick={openDeleteModal}
          >
            <span>
              {t("common.delete")}
            </span>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    {/if}
    <div class="col-4">
      <BaseInput
        icon="search"
        placeholder={t("common.search")}
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
          {t("common.status")}
        </div>
        <BaseSelect
          items={statuses}
          bind:value={params.aLinked}
          size="sm"
          placeholder={t("common.all")}
        ></BaseSelect>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.view-as")}
        </div>
        <BaseSelect items={viewAsOptions} bind:value={viewAs} size="sm"
        ></BaseSelect>
      </div>
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{institution.project_id}/import-assets/steps?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("menu.import-assets")}</a
      >
    </div>
  </div>
  {#if filteredItems.length > 0}
    {#if viewAs === "grid"}
      <div class="row">
        {#each filteredItems as asset (asset.id)}
          <div class="col-3">
            <AssetCard {asset} view={params.view} bind:selected={selectedAssets}
            />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <Table
        items={filteredItems}
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
            label: t("common.filename"),
            sortable: true,
            accessor: (value) => {
              const text = value.filename;
              const viewQuery = params.view ? `?view=${encodeURIComponent(params.view)}` : "";
              const url = `/projects/${value.project_id}/institutions/${value.institution_id}/assets/${value.id}${viewQuery}`;
              return {
                url,
                text,
              };
            },
            render: (value) => ({
              component: TableLink,
              props: value,
            }),
          },
          {
            value: "created_at",
            label: t("common.created-at"),
            sortable: true,
            render: (value) =>
              formatDate(+value, translationState.currentLocale, true),
          },
          {
            value: "updated_at",
            label: t("common.updated-at"),
            sortable: true,
            render: (value) =>
              formatDate(+value, translationState.currentLocale, true),
          },
          {
            value: "linked",
            label: t("common.linked"),
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
  {:else if filteredItems.length === 0}
    <div class="text-center text-black-50 fs-4 fst-italic mt-4">
      {t("common.no-assets-found")}
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

  {#if isDeleteModalOpen}
    <BulkDeleteAssetsModal
      bind:isOpen={isDeleteModalOpen}
      selectedIds={selectedAssets}
      on:deleted={handleBulkDeleted}
    />
  {/if}

  {#if isLinkModalOpen}
    <LinkObjectsModal
      bind:isOpen={isLinkModalOpen}
      projectId={institution.project_id}
      assetId={linkAssetId}
      preselectExisting={false}
      onLinked={handleModalLinked}
    />
  {/if}
</div>
