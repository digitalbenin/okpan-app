<script>
  import { queryParameters } from "sveltekit-search-params";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionsGrid from "$lib/components/institutions/InstitutionsGrid.svelte";
  import BulkActionsStatusSelect from "$lib/components/objects/BulkActionsStatusSelect.svelte";
  import { updateInstitutionsStatusBulk } from "$lib/api/InstitutionsApi.js";
  import { topCurtainOverlay } from "$lib/utils/transitions.js";
  import { IconBuildingBank, IconSearch, IconPlus, IconSortAscendingLetters, IconSortDescendingLetters, IconSortAscendingNumbers, IconSortDescendingNumbers, IconSortAscending, IconSortDescending } from "@tabler/icons-svelte";
  import PageHeader from "$lib/components/base/PageHeader.svelte";
  import { goto } from "$app/navigation";

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

  const statuses = $derived([
    { value: "all", label: t("common.all") },
    { value: "in progress", label: t("common.in-progress") },
    { value: "completed", label: t("common.completed") },
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

<PageHeader
  icon={IconBuildingBank}
  iconBgClass="bg-blue-100"
  iconColorClass="text-blue-400"
  title={t("common.institutions")}
  description={t("institutions.page-description", { fallback: "The museums, archives, and libraries where your objects come from." })}
/>

<div class="d-flex justify-content-between align-items-center pb-3 mt-4">
  <div class="input-group" style="width: 300px;">
    <input
      type="text"
      class="form-control border-end-0 border-white"
      placeholder={t("common.search")}
      bind:value={params.search}
    />
    <span class="input-group-text bg-white relative border-white" style="left: -1px; border-left: none;">
      <IconSearch size={18} class="text-body-secondary" />
    </span>
  </div>
  <div class="d-flex gap-2">
    <a href="/projects/{data.project.id}/institutions/add" class="btn btn-primary btn-sm d-flex align-items-center gap-1">
      <IconPlus size={16} />
      {t("menu.add-institution")}
    </a>
  </div>
</div>

<div class="position-relative mb-3">
  <div class="d-flex justify-content-end gap-3 align-items-center">
    <div class="d-flex align-items-center gap-2">
      <BaseDropdownMenu 
      bind:open={sortOpen} 
        contentProps={{ style: "right: 0; left: auto;" }}
        side="bottom"
        align="end"
        triggerClass="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
        {#snippet trigger()}
          {currentSort.label}
          <i class="bi bi-chevron-down"></i>
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
  <div class="border border-dashed rounded-4 d-flex flex-column align-items-center justify-content-center" style="height: 120px;">
    <p class="text-body-secondary fs-7 mb-0">
      {t("institutions.no-institutions-yet", { fallback: "No institutions yet. Add one by clicking on \"Add institution\"." })}
    </p>
  </div>
{/if}
