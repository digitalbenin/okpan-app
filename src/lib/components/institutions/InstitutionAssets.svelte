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
  import { cubicInOut } from "svelte/easing";
  import { watch } from "runed";

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

  const assetItems = $derived(assets.items || []);

  watch(
    () => params?.aLinked,
    (nextValue, previousValue) => {
      if (previousValue !== undefined && nextValue !== previousValue) {
        params.aPage = 1;
      }
    },
  );

  watch(
    () => params?.aSearch,
    (nextValue, previousValue) => {
      if (previousValue !== undefined && nextValue !== previousValue) {
        params.aPage = 1;
      }
    },
  );

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

  function topCurtainFly(node, params = {}) {
    const {
      delay = 0,
      duration = 220,
      easing = cubicInOut,
      y = -20,
      opacity = 0.18,
    } = params;

    const style = getComputedStyle(node);
    const height = node.offsetHeight;
    const marginTop = parseFloat(style.marginTop) || 0;
    const marginBottom = parseFloat(style.marginBottom) || 0;
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingBottom = parseFloat(style.paddingBottom) || 0;

    return {
      delay,
      duration,
      easing,
      css: (t, u) => `
        overflow: hidden;
        opacity: ${opacity + t * (1 - opacity)};
        transform: translateY(${u * y}px);
        height: ${t * height}px;
        margin-top: ${t * marginTop}px;
        margin-bottom: ${t * marginBottom}px;
        padding-top: ${t * paddingTop}px;
        padding-bottom: ${t * paddingBottom}px;
        clip-path: inset(0 0 ${u * 100}% 0);
      `,
    };
  }
</script>

<div class="w-100 mb-3">
  <div class="row align-items-center mb-3 py-2">
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
        class="btn btn-secondary btn-sm"
        href="/projects/{institution.project_id}/import-assets/steps?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("menu.import-assets")}</a
      >
    </div>
  </div>
  {#if selectedAssets.length > 0}
    <div transition:topCurtainFly={{ y: -24, duration: 240 }} class="mb-0">
      <div class="row pb-3">
        <div class="col-12 d-flex align-items-center gap-2 flex-wrap py-2">
          <button
            class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
            onclick={clearSelection}
          >
            <span>
              {t("common.clear-selection")}
            </span>
            <i class="bi bi-x-circle"></i>
          </button>
          <button
            class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
            onclick={openLinkModal}
          >
            <span>
              {t("common.link-to-object")}
            </span>
            <i class="bi bi-link-45deg"></i>
          </button>
          <button
            class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
            onclick={openBulkEdit}
          >
            <span>
              {t("common.edit-metadata")}
            </span>
            <i class="bi bi-pencil-square"></i>
          </button>
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
    </div>
  {/if}
  {#if assetItems.length > 0}
    {#if viewAs === "grid"}
      <div class="row">
        {#each assetItems as asset (asset.id)}
          <div class="col-3">
            <AssetCard {asset} view={params.view} bind:selected={selectedAssets}
            />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <Table
        items={assetItems}
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
  {:else if assetItems.length === 0}
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
