<script>
  import { queryParameters } from "sveltekit-search-params";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionsGrid from "$lib/components/institutions/InstitutionsGrid.svelte";
  import { IconBuildingBank, IconCirclePlus, IconChevronDown, IconSortAscendingLetters, IconSortDescendingLetters, IconSortAscendingNumbers, IconSortDescendingNumbers, IconSortAscending, IconSortDescending } from "@tabler/icons-svelte";
  import PageHeader from "$lib/components/base/PageHeader.svelte";

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
  });

  const { data } = $props();
  let sortOpen = $state(false);

  const sortOptions = $derived([
    { label: t("common.sort-by-date", { fallback: "Sort by date" }), icon: IconSortDescendingNumbers, orderBy: "created_at", direction: "desc" },
    { label: t("common.sort-by-date", { fallback: "Sort by date" }), icon: IconSortAscendingNumbers, orderBy: "created_at", direction: "asc" },
    { label: t("common.sort-by-name", { fallback: "Sort by name" }), icon: IconSortDescendingLetters, orderBy: "name", direction: "desc" },
    { label: t("common.sort-by-name", { fallback: "Sort by name" }), icon: IconSortAscendingLetters, orderBy: "name", direction: "asc" },
    { label: t("common.sort-by-objects", { fallback: "Sort by objects" }), icon: IconSortDescending, orderBy: "objectsCount", direction: "desc" },
    { label: t("common.sort-by-objects", { fallback: "Sort by objects" }), icon: IconSortAscending, orderBy: "objectsCount", direction: "asc" },
  ]);

  const currentSort = $derived(sortOptions.find(o => o.orderBy === params.orderBy && o.direction === params.direction) ?? sortOptions[0]);
</script>

<PageHeader
  icon={IconBuildingBank}
  iconBgClass="bg-blue-100"
  iconColorClass="text-blue-400"
  title={t("common.institutions")}
  description={t("institutions.page-description", { fallback: "The museums, archives, and libraries where your objects come from." })}
/>

<BaseSearchBar bind:search={params.search} placeholder={t("common.search")}>
  {#snippet children()}
    <a href="/projects/{data.project.id}/institutions/add" class="btn btn-primary btn-sm d-flex align-items-center gap-1">
      <IconCirclePlus size={16} />
      {t("menu.add-institution")}
    </a>
  {/snippet}
  {#snippet toolbar()}
    <div></div>
    <div class="d-flex align-items-center gap-2">
      <BaseDropdownMenu 
      bind:open={sortOpen} 
        contentProps={{ style: "right: 0; left: auto;" }}
        side="bottom"
        align="end"
        triggerClass="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
        {#snippet trigger()}
          {currentSort.label}
          <IconChevronDown size={16} />
        {/snippet}
        {#snippet children()}
          {#each sortOptions as option}
            <button
              class="dropdown-item rounded px-2 py-1 d-flex align-items-center gap-2"
              class:active={params.orderBy === option.orderBy && params.direction === option.direction}
              onclick={() => { params.orderBy = option.orderBy; params.direction = option.direction; sortOpen = false; }}
            >
              <option.icon size={16} class="text-body-secondary" />
              <span class="flex-grow-1">{option.label}</span>
            </button>
          {/each}
        {/snippet}
      </BaseDropdownMenu>
    </div>
  {/snippet}
</BaseSearchBar>

{#if data.institutions?.count}
  <div class="mb-3">
    {data.institutions.count}
    {#if data.institutions.count > 1}
      {t("common.institutions")}
    {:else}
      {t("common.institution")}
    {/if}
  </div>
  <InstitutionsGrid
    institutions={data.institutions.result}
    bind:page={params.page}
    pageSize={params.pageSize}
    count={data.institutions.count}
  />
{:else if params.search}
  <div class="border border-dashed rounded-4 d-flex flex-column align-items-center justify-content-center" style="height: 120px;">
    <p class="text-body-secondary fs-7 mb-0">
      {t("common.no-results", { fallback: "No results found for your search." })}
    </p>
  </div>
{:else}
  <div class="border border-dashed rounded-4 d-flex flex-column align-items-center justify-content-center" style="height: 120px;">
    <p class="text-body-secondary fs-7 mb-0">
      {t("institutions.no-institutions-yet", { fallback: "No institutions yet. Add one by clicking on \"Add institution\"." })}
    </p>
  </div>
{/if}
