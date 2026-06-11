<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconChartCircles, IconChevronDown, IconSortAscendingLetters, IconSortDescendingLetters, IconSortAscendingNumbers, IconSortDescendingNumbers, IconSortAscending, IconSortDescending } from "@tabler/icons-svelte";
  import AddConnectionTypeModal from "$lib/components/research_fields/AddConnectionTypeModal.svelte";
  import ConnectionTypeImportModal from "$lib/components/research_fields/ConnectionTypeImportModal.svelte";
  import ConnectionTypeCard from "$lib/components/research_fields/ConnectionTypeCard.svelte";
  import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import PageHeader from "$lib/components/base/PageHeader.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();
  let search = $state("");
  let sortOpen = $state(false);

  const sortOptions = $derived([
    { label: t("common.sort-by-date", { fallback: "Sort by date" }), icon: IconSortDescendingNumbers, orderBy: "created_at", direction: "desc" },
    { label: t("common.sort-by-date", { fallback: "Sort by date" }), icon: IconSortAscendingNumbers, orderBy: "created_at", direction: "asc" },
    { label: t("common.sort-by-name", { fallback: "Sort by name" }), icon: IconSortDescendingLetters, orderBy: "name", direction: "desc" },
    { label: t("common.sort-by-name", { fallback: "Sort by name" }), icon: IconSortAscendingLetters, orderBy: "name", direction: "asc" },
    { label: t("common.sort-by-connections", { fallback: "Sort by connections" }), icon: IconSortDescending, orderBy: "connections", direction: "desc" },
    { label: t("common.sort-by-connections", { fallback: "Sort by connections" }), icon: IconSortAscending, orderBy: "connections", direction: "asc" },
  ]);

  let sortOrderBy = $state("created_at");
  let sortDirection = $state("desc");

  const currentSort = $derived(sortOptions.find(o => o.orderBy === sortOrderBy && o.direction === sortDirection) ?? sortOptions[0]);

  const filteredFields = $derived.by(() => {
    let fields = (data.researchFields || []).filter((field) =>
      !search || (field.name?.content || "").toLowerCase().includes(search.toLowerCase())
    );

    fields = [...fields].sort((a, b) => {
      let cmp = 0;
      if (sortOrderBy === "name") {
        cmp = (a.name?.content || "").localeCompare(b.name?.content || "");
      } else if (sortOrderBy === "created_at") {
        cmp = (a.created_at || 0) - (b.created_at || 0);
      } else if (sortOrderBy === "connections") {
        cmp = (a.vocabularies?.length || 0) - (b.vocabularies?.length || 0);
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

    return fields;
  });
</script>

<PageHeader
  icon={IconChartCircles}
  iconBgClass="bg-orange-100"
  iconColorClass="text-orange-400"
  title={t("project.connection-types", { fallback: "Connection types" })}
  description={t("project.connection-types-description", { fallback: "The types of relationships you can define between the objects in your collection." })}
/>

<BaseSearchBar bind:search placeholder={t("common.search")}>
  {#snippet children()}
    <ConnectionTypeImportModal projectId={data.project.id} languages={data.languages} />
    <AddConnectionTypeModal projectId={data.project.id} languages={data.languages} />
  {/snippet}
  {#snippet toolbar()}
    <div class="d-flex align-items-center justify-content-between w-100">
      <span class="small">
        {filteredFields.length}
        {filteredFields.length === 1
          ? t("common.connection-type", { fallback: " connection type" })
          : t("common.connection-types", { fallback: " connection types" })}
      </span>
      <BaseDropdownMenu
        bind:open={sortOpen}
        contentProps={{ style: "right: 0; left: auto;" }}
        side="bottom"
        align="end"
        triggerClass="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
      >
        {#snippet trigger()}
          {currentSort.label}
          <IconChevronDown size={16} />
        {/snippet}
        {#snippet children()}
          {#each sortOptions as option}
            <button
              class="dropdown-item rounded px-2 py-1 d-flex align-items-center gap-2"
              class:active={sortOrderBy === option.orderBy && sortDirection === option.direction}
              onclick={() => { sortOrderBy = option.orderBy; sortDirection = option.direction; sortOpen = false; }}
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

<div class="row g-3">
    {#each filteredFields as field (field.id)}
      <div class="col-md-6">
        <ConnectionTypeCard {field} projectId={data.project.id} />
      </div>
    {/each}
  {#if (data.researchFields.length === 0) }
   <div class="border border-dark-subtle  dashed rounded-4 d-flex align-items-center justify-content-center col-12 text-center text-muted mt-4" style="height:150px;">
      {t("connections.no-connections-present", { fallback: "No connection types present." })}
    </div>
    
  {:else if (filteredFields.length === 0)}
    <div class="border border-dark-subtle  dashed rounded-4 d-flex align-items-center justify-content-center col-12 text-center text-muted mt-4" style="height:150px;">
      {t("common.no-connections-found", { fallback: "No connection types found." })}
    </div>
  {/if}
</div>

<style>
  .border.dashed {
    border-style: dashed !important;
  }
</style>