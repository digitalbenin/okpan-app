<script>
  import { queryParameters } from "sveltekit-search-params";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionsGrid from "$lib/components/institutions/InstitutionsGrid.svelte";

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

  const orderBy = $derived([
    { value: "name", label: t("common.name", { fallback: "Name" }) },
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
</script>

<div class="container-fluid h-100 bg-light">
  <div class="row pt-3 pb-3 border-bottom mb-4 align-items-center">
    <div class="col">
      <h2 class="m-0 d-flex align-items-center gap-2">
        <i class="bi bi-bank2 text-muted"></i>
        {t("common.institutions", { fallback: "Institutions" })}
      </h2>
    </div>
    <div class="col-auto">
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{data.project.id}/institutions/add"
      >
        <i class="bi bi-plus-lg"></i>
        {t("common.add-institution", { fallback: "Add Institution" })}
      </a>
    </div>
  </div>
  <div class="row align-items-center mb-3">
    <div class="col-3">
      <BaseInput
        icon="search"
        placeholder={t("common.search", { fallback: "Search" })}
        clearable
        size="sm"
        bind:value={params.search}
      />
    </div>
    <div class="col-9 d-flex justify-content-end gap-3 align-items-center">
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.order-by", { fallback: "Order by" })}
        </div>
        <BaseSelect items={orderBy} bind:value={params.orderBy} size="sm"
        ></BaseSelect>
      </div>

      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.status", { fallback: "Status" })}
        </div>
        <BaseSelect items={statuses} bind:value={params.status} size="sm"
        ></BaseSelect>
      </div>
    </div>
  </div>
  {#if data.institutions?.count}
    <div class="border-bottom mb-3">
      {data.institutions.count}
      {#if data.institutions.count > 1}
        {t("common.institutions", { fallback: "institutions" })}
      {:else}
        {t("common.institution", { fallback: "institution" })}
      {/if}
    </div>
    <InstitutionsGrid
      institutions={data.institutions.result}
      bind:page={params.page}
      pageSize={params.pageSize}
      count={data.institutions.count}
    />
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {t("common.no-institutions-found", {
        fallback: "No institutions found.",
      })}
    </div>
  {/if}
</div>
