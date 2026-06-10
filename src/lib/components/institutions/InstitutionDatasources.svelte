<script>
  import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import DatasourceCard from "$lib/components/datasources/DatasourceCard.svelte";
  import Table from "$lib/components/base/table/Table.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconCirclePlus } from "@tabler/icons-svelte";
  import { formatDate } from "$lib/utils/dates.js";
  import { page as pageData } from "$app/state";

  let { datasources, params = $bindable() } = $props();

  const { t, translationState } = getTranslationStore();

  let viewAs = $state("table");

  const projectId = $derived(pageData.params.project_id);
  const institutionId = $derived(pageData.params.institution_id);
  const importDataHref = $derived(
    `/projects/${projectId}/import-data${institutionId ? `?institution_id=${encodeURIComponent(institutionId)}` : ""}`,
  );
</script>

<div class="w-100">
<BaseSearchBar bind:search={params.sSearch} placeholder={t("common.search")} border="border-gray-800">
  {#snippet children()}
    <a class="btn btn-primary btn-sm d-flex align-items-center gap-1" href={importDataHref}>
      <IconCirclePlus size={16} />
      {t("common.import-data")}
    </a>
  {/snippet}
</BaseSearchBar>
  
  {#if datasources.items.length > 0}
    {#if viewAs === "grid"}
      <div class="row">
        {#each datasources.items as datasource (datasource.id)}
          <div class="col-4">
            <DatasourceCard {datasource} {projectId} />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <Table
        items={datasources.items}
        selectable={false}
        columns={[
          {
            value: "name",
            label: t("common.name"),
            sortable: true,
            accessor: (value) => {
              return value.name.content;
            },
            render: (value, item) => {
              return `<a href="/projects/${projectId}/institutions/${institutionId}/datasources/${item.id}" class="text-decoration-none">${value}</a>`;
            },
          },
          {
            value: "date",
            label: t("common.date"),
            sortable: true,
            render: (value) =>
              formatDate(+value, translationState.currentLocale),
          },
          {
            value: "objectsCount",
            label: t("common.objects-count"),
            sortable: true,
          },
        ]}
        bind:orderBy={params.sOrderBy}
        bind:direction={params.sDirection}
      />
    {/if}
  {:else if datasources.items.length === 0}
    <div class="text-center text-black-50 fs-4 fst-italic mt-4">
      {t("common.no-datasources-found")}
    </div>
  {/if}

  {#if datasources.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination
          bind:page={params.sPage}
          pageSize={params.pageSize}
          count={datasources.totalCount}
          size="sm"
        />
      </div>
    </div>
  {/if}
</div>
