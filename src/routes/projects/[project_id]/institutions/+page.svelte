<script>
  import { queryParameters } from "sveltekit-search-params";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionsGrid from "$lib/components/institutions/InstitutionsGrid.svelte";
  import BulkActionsStatusSelect from "$lib/components/objects/BulkActionsStatusSelect.svelte";
  import { updateInstitutionsStatusBulk } from "$lib/api/InstitutionsApi.js";
  import { topCurtainOverlay } from "$lib/utils/transitions.js";

  const { t } = getTranslationStore();

  const params = queryParameters({
    page: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    pageSize: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 25,
    },
    orderBy: {
      encode: (value) => value,
      decode: (value) => value,
      defaultValue: "name",
    },
    direction: {
      encode: (value) => value,
      decode: (value) => value,
      defaultValue: "asc",
    },
    search: {
      encode: (value) => value,
      decode: (value) => value,
      defaultValue: undefined,
    },
    status: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: undefined,
    },
  });

  const { data } = $props();
  let selectedInstitutions = $state([]);
  let bulkStatusValue = $state("");

  const orderBy = $derived([
    { value: "name", label: t("common.name") },
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
      value: "in progress",
      label: t("common.in-progress"),
    },
    {
      value: "completed",
      label: t("common.completed"),
    },
  ]);

  const clearSelection = () => {
    selectedInstitutions = [];
  };

  const applyBulkStatus = async () => {
    if (!bulkStatusValue || selectedInstitutions.length === 0) return;
    const { errors } = await updateInstitutionsStatusBulk(selectedInstitutions, bulkStatusValue);
    if (errors?.length) {
      return;
    }
    selectedInstitutions = [];
    bulkStatusValue = "";
  };
</script>

<div class="container-fluid" style="min-height: 100%;">
  <div class="row pt-3 pb-3 border-bottom mb-4 align-items-center">
    <div class="col">
      <h2 class="m-0 d-flex align-items-center gap-2">
        <i class="bi bi-bank2 text-muted"></i>
        {t("common.institutions")}
      </h2>
    </div>
    <div class="col-auto">
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{data.project.id}/institutions/add"
      >
        <i class="bi bi-plus-lg"></i>
        {t("menu.add-institution")}
      </a>
    </div>
  </div>
  <div class="position-relative mb-3">
    <div class="row align-items-center">
      <div class="col-3">
        <BaseInput
          icon="search"
          placeholder={t("common.search")}
          clearable
          size="sm"
          bind:value={params.search}
        />
      </div>
      <div class="col-9 d-flex justify-content-end gap-3 align-items-center mb-1">
        <div class="d-flex align-items-center gap-2">
          <div class="col-auto fs-7">
            {t("common.order-by")}
          </div>
          <BaseSelect items={orderBy} bind:value={params.orderBy} size="sm"
          ></BaseSelect>
        </div>

        <div class="d-flex align-items-center gap-2">
          <div class="col-auto fs-7">
            {t("common.status")}
          </div>
          <BaseSelect items={statuses} bind:value={params.status} size="sm"
          ></BaseSelect>
        </div>
      </div>
    </div>

    {#if selectedInstitutions.length > 0}
      <div
        transition:topCurtainOverlay={{ y: -20, duration: 220 }}
        class="position-absolute top-0 start-0 end-0 bottom-0 z-2 bg-light"
      >
        <div class="row align-items-center h-100">
          <div class="col-12 d-flex gap-3 align-items-center mt-1 mb-0">
            <button class="btn btn-secondary btn-sm d-flex align-items-center gap-2" onclick={clearSelection}>
              <span>{t("common.clear-selection", { fallback: "Clear selection" })}</span>
              <i class="bi bi-x-circle"></i>
            </button>
            <BulkActionsStatusSelect
              items={statuses.filter((status) => status.value !== "all")}
              bind:value={bulkStatusValue}
              onValueChange={applyBulkStatus}
            />
          </div>
        </div>
      </div>
    {/if}
  </div>
  {#if data.institutions?.count}
    <div class="border-bottom mb-3">
      {data.institutions.count}
      {#if data.institutions.count > 1}
        {t("common.institutions")}
      {:else}
        {t("common.institution")}
      {/if}
    </div>
    <InstitutionsGrid
      institutions={data.institutions.result}
      bind:selected={selectedInstitutions}
      bind:page={params.page}
      pageSize={params.pageSize}
      count={data.institutions.count}
    />
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {t("common.no-institutions-found")}
    </div>
  {/if}
</div>
