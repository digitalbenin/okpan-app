<script>
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import ObjectCard from "$lib/components/overview/ObjectCard.svelte";
  import ObjectsTable from "$lib/components/objects/ObjectsTable.svelte";
  import InstitutionObjectsFields from "$lib/components/institutions/InstitutionObjectsFields.svelte";
  import ObjectAdvancedFilters from "$lib/components/objects/ObjectAdvancedFilters.svelte";
  import BulkDeleteObjectsModal from "$lib/components/objects/BulkDeleteObjectsModal.svelte";
  import BulkChangeInstitutionModal from "$lib/components/objects/BulkChangeInstitutionModal.svelte";
  import BulkEditObjectsModal from "$lib/components/objects/BulkEditObjectsModal.svelte";
  import BulkActionsStatusSelect from "$lib/components/objects/BulkActionsStatusSelect.svelte";
  import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { topCurtainOverlay } from "$lib/utils/transitions.js";
  import { IconBox } from "@tabler/icons-svelte";
  import PageHeader from "$lib/components/base/PageHeader.svelte";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import { IconChevronDown, IconFilter, IconGridDots, IconList, IconCirclePlus, IconTrash, IconX, IconTableImport, IconCircleX, IconArrowMoveRight, IconTransform, IconPencil } from "@tabler/icons-svelte";
  import { updateObjectsStatusBulk, updateObjectsInstitutionBulk } from "$lib/api/ObjectsApi.js";

  let { params = $bindable(), project, objects, displayFields, researchFields, ontologyFields, institutions } = $props();

  const { t } = getTranslationStore();

  // UI state
  let selectedObjects = $state([]);
  let bulkStatusValue = $state("");
  let showAdvancedFilters = $state(false);
  let advancedFilters = $state(params.filters || {});
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);
  let showBulkEditModal = $state(false);

  // Sync advanced filters from URL on navigation (handles browser back/forward)
  afterNavigate(() => { advancedFilters = params.filters || {}; });

  const listQuery = $derived($page.url.search || "");
  const viewAs = $derived(params.viewAs || "grid");
  // Workaround for SvelteKit's reactivity issue with query parameters in table sort bindings
  const paramsBinding = $derived({ current: params });
  const searchData = $derived(objects || { items: [], totalCount: 0, facets: {} });

  // Helpers for building lookup maps from fields that may arrive as arrays or { result: [] }
  const getFieldList = (fields) => fields?.result || fields || [];
  const buildFieldMap = (fields) =>
    new Map(getFieldList(fields).map((f) => [String(f.id), f.name?.content || f.name || String(f.id)]));

  const researchFieldsById = $derived(buildFieldMap(researchFields));
  const ontologyFieldsById = $derived(buildFieldMap(ontologyFields));
  const institutionsById = $derived(
    new Map(getFieldList(institutions).map((i) => [String(i.id), i.name?.content || i.name || String(i.id)]))
  );

  const vocabularies = $derived(
    getFieldList(researchFields)
      .filter((f) => (f.type || "").toLowerCase() === "vocabulary")
      .flatMap((f) =>
        (f.vocabularies || []).map((v) => ({ id: v.id, field_id: f.id, name: v.option?.content || v.option, mainAsset: v.mainAsset || null }))
      )
  );

  const vocabularyFieldIds = $derived(
    new Set(
      getFieldList(researchFields)
        .filter((f) => (f.type || "").toLowerCase() === "vocabulary")
        .map((f) => String(f.id))
    )
  );

  const vocabById = $derived(new Map(vocabularies.map((v) => [String(v.id), v.name])));

  const ontologyFieldsList = $derived([
    { value: "all", label: t("common.all", { fallback: "All" }) },
    { value: "name", label: t("common.name", { fallback: "Name" }) },
    ...getFieldList(ontologyFields).map((f) => ({ value: String(f.id), label: f.name?.content || f.name })),
  ]);

  const statuses = $derived([
    { value: "all", label: t("common.all-status", { fallback: "All status" }) },
    { value: "in progress", label: t("common.in-progress", { fallback: "In progress" }) },
    { value: "completed", label: t("common.completed", { fallback: "Completed" }) },
  ]);

  const sortOptions = $derived([
    { value: "updated_at", label: t("common.sort-by-date", { fallback: "Sort by date" }) },
    { value: "created_at", label: t("common.sort-by-created", { fallback: "Sort by created" }) },
    { value: "name", label: t("common.sort-by-name", { fallback: "Sort by name" }) },
  ]);

  const hasAppliedFilters = $derived(
    (params.status && params.status !== "all") ||
    !!(params.search?.trim()) ||
    (advancedFilters?.institutions || []).length > 0 ||
    Object.entries(advancedFilters || {}).some(
      ([k, v]) => k !== "__textFilters" && k !== "institutions" && Array.isArray(v) && v.length > 0
    ) ||
    (advancedFilters?.__textFilters || []).length > 0
  );

  // Helpers for clearing individual filter entries
  const clearParam = (key, value) => { params[key] = value; params.page = 1; };
  const clearFilterArray = (key, filterFn) => {
    advancedFilters = { ...advancedFilters, [key]: (advancedFilters[key] || []).filter(filterFn) };
    params.filters = advancedFilters;
    params.page = 1;
  };

  const filterBadges = $derived.by(() => {
    const badges = [];

    if (params.status && params.status !== "all") {
      const label = statuses.find((s) => s.value === params.status)?.label || params.status;
      badges.push({ text: `${t("common.status", { fallback: "Status" })}: ${label}`, onClear: () => clearParam("status", "all") });
    }

    if (params.search?.trim()) {
      const fieldLabel = ontologyFieldsList.find((o) => o.value === params.searchField)?.label || t("common.search", { fallback: "Search" });
      badges.push({ text: `${fieldLabel}: ${params.search}`, onClear: () => clearParam("search", "") });
    }

    (advancedFilters?.institutions || []).forEach((instId) => {
      const name = institutionsById.get(String(instId)) || String(instId);
      badges.push({
        text: `${t("common.institution", { fallback: "Institution" })}: ${name}`,
        onClear: () => clearFilterArray("institutions", (id) => String(id) !== String(instId)),
      });
    });

    Object.entries(advancedFilters || {})
      .filter(([k, v]) => k !== "__textFilters" && k !== "institutions" && Array.isArray(v) && v.length > 0 && vocabularyFieldIds.has(String(k)))
      .forEach(([fieldId, ids]) => {
        const fieldName = researchFieldsById.get(String(fieldId)) || String(fieldId);
        ids.forEach((vocabId) => {
          badges.push({
            text: `${fieldName}: ${vocabById.get(String(vocabId)) || String(vocabId)}`,
            onClear: () => clearFilterArray(fieldId, (id) => String(id) !== String(vocabId)),
          });
        });
      });

    (advancedFilters?.__textFilters || []).forEach((tf) => {
      const fieldName = tf.kind === "research"
        ? researchFieldsById.get(String(tf.fieldId))
        : ontologyFieldsById.get(String(tf.fieldId));
      badges.push({
        text: `${fieldName || String(tf.fieldId)}: ${tf.query}`,
        onClear: () => {
          advancedFilters = {
            ...advancedFilters,
            __textFilters: (advancedFilters.__textFilters || []).filter(
              (x) => !(x.kind === tf.kind && String(x.fieldId) === String(tf.fieldId))
            ),
          };
          params.filters = advancedFilters;
          params.page = 1;
        },
      });
    });

    return badges;
  });

  // Bulk action handlers
  const applyBulkStatus = async () => {
    if (!bulkStatusValue || !selectedObjects.length) return;
    const { errors } = await updateObjectsStatusBulk(selectedObjects, bulkStatusValue);
    if (errors?.length) console.error("Bulk status update errors:", errors);
    selectedObjects = [];
    bulkStatusValue = "";
  };

  const handleConfirmInstitution = async ({ institutionId }) => {
    if (!institutionId || !selectedObjects.length) { showBulkInstitutionModal = false; return; }
    const { errors } = await updateObjectsInstitutionBulk(selectedObjects, institutionId);
    if (errors?.length) console.error("Bulk institution update errors:", errors);
    selectedObjects = [];
    showBulkInstitutionModal = false;
  };

  const openBulkEdit = () => {
    if (!selectedObjects?.length) return;
    showBulkEditModal = true;
  };

  const onFiltersChange = () => {
    advancedFilters = { ...advancedFilters };
    params.filters = advancedFilters;
    params.page = 1;
  };
</script>

{#snippet actionButton(icon, text, onClick, variant = "secondary")}
  <button class="btn btn-{variant} btn-sm d-flex align-items-center gap-2" onclick={onClick}>
    <svelte:component this={icon} size={16} />
    <span>{text}</span>
    
  </button>
{/snippet}

<PageHeader
  icon={IconBox}
  iconBgClass="bg-purple-100"
  iconColorClass="text-purple-400"
  title={t("common.objects", { fallback: "Objects" })}
  description={t("objects.page-description", { fallback: "The cultural items you are researching and documenting across institutions." })}
/>

<div class="container-fluid mt-4 px-0 pb-4" style="min-height: 100%;">

<BaseSearchBar bind:search={params.search} placeholder={t("common.search", { fallback: "Search" })} oninput={() => { params.searchField = "all"; params.page = 1; }}>
  {#snippet children()}
  <a class="btn btn-primary btn-sm" href="/projects/{project.id}/import-data">
      
      <IconTableImport size={16} />
      {t("menu.import-data", { fallback: "Import Data" })}
    </a>  
  
  <a class="btn btn-primary btn-sm" href="/projects/{project.id}/objects/add">
      
      <IconCirclePlus size={16} />
      {t("menu.add-object", { fallback: "Add Object" })}
    </a>
  {/snippet}
  {#snippet toolbar()}
    <div class="col-auto">
      {searchData.totalCount}
      {searchData.totalCount === 1 ? t("common.object", { fallback: "object" }) : t("common.objects", { fallback: "objects" })}
    </div>
    <div class="d-flex justify-content-end gap-2 flex-wrap">
      <BaseSelect items={statuses} bind:value={params.status} as="button" inputClass="btn-transparent btn-sm border border-dark">
        <IconChevronDown size={16} />
      </BaseSelect>
      <BaseSelect items={sortOptions} bind:value={params.orderBy} as="button" inputClass="btn-transparent btn-sm border border-dark">
        <IconChevronDown size={16} />
      </BaseSelect>
      <InstitutionObjectsFields
        {displayFields}
        {researchFields}
        projectId={project.id}
        as="button"
        inputClass="btn-transparent btn-sm border border-dark"
      />
      <button type="button" class="btn btn-transparent btn-sm border border-dark" onclick={() => (showAdvancedFilters = true)}>
        <IconFilter size={16} />
        {t("common.filter", { fallback: "Filter" })}
      </button>
      <div class="btn-group btn-group-sm" role="group" aria-label={t("common.view-as", { fallback: "View as" })}>
        {#each [{ val: "grid", icon: "grid-3x3-gap", label: t("common.grid-view", { fallback: "Grid" }) }, { val: "table", icon: "list", label: t("common.table-view", { fallback: "Table" }) }] as view}
          <button
            type="button"
            class="btn btn-transparent border border-dark"
            class:active={viewAs === view.val}
            class:btn-dark={viewAs === view.val}
            onclick={() => (params.viewAs = view.val)}
            aria-label={view.label}
          >
            {#if view.val === "grid"}
              <IconGridDots size={16} />
            {:else if view.val === "table"}
              <IconList size={16} />
            {/if}
          </button>
        {/each}
      </div>
    </div>
    {#if selectedObjects.length}
      <div
        transition:topCurtainOverlay={{ y: -20, duration: 220 }}
        class="position-absolute top-0 start-0 end-0 bottom-0 z-2 bg-gray-200"
      >
        <div class="row align-items-center g-2 pb-2 h-100">
          <div class="col d-flex align-items-center gap-2 flex-wrap">
            {@render actionButton(IconCircleX, t("common.clear-selection", { fallback: "Clear selection" }), () => (selectedObjects = []))}
            {@render actionButton(IconArrowMoveRight, t("common.change-institution", { fallback: "Change institution" }), () => (showBulkInstitutionModal = true))}
            <BulkActionsStatusSelect
              items={statuses.filter((s) => s.value !== "all")}
              bind:value={bulkStatusValue}
              onValueChange={applyBulkStatus}
            />
            {@render actionButton(IconPencil, t("objects.edit-selected", { fallback: "Edit selected" }), openBulkEdit)}
            {@render actionButton(IconTrash, t("common.delete-selected", { fallback: "Delete" }), () => (showBulkDeleteModal = true), "danger")}
          </div>
        </div>
      </div>
    {/if}
  {/snippet}
</BaseSearchBar>

  {#if hasAppliedFilters}
    <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
      {#each filterBadges as { text, onClear }}
        <button
          type="button"
          class="btn btn-outline-dark  btn-sm d-flex align-items-center gap-1 rounded-2"
          aria-label={t("common.remove", { fallback: "Remove" })}
          onclick={onClear}
        >
          <span class="text-truncate" style="max-width: 240px;">{text}</span>
          <IconX size={16} />
        </button>
      {/each}
    </div>
  {/if}

  {#if searchData.totalCount}
    {#key displayFields}
      {#if viewAs === "grid"}
        <div class="row g-4">
          {#each searchData.items as object (object.id)}
            <div class="col-3">
              <ObjectCard {object} {displayFields} displayInstitution={true} bind:selected={selectedObjects} {listQuery} />
            </div>
          {/each}
        </div>
      {:else if viewAs === "table"}
        <ObjectsTable
          items={searchData.items}
          bind:orderBy={paramsBinding.current.orderBy}
          bind:direction={paramsBinding.current.direction}
          bind:selectedObjects
          {displayFields}
          displayInstitution={true}
          {listQuery}
        />
      {/if}
    {/key}
  {:else}
    <div class="text-center fst-italic text-muted border border-2 rounded py-5" style="border-style: dashed !important;">
      {t("objects.no-objects-found", { fallback: "No objects found" })}
    </div>
  {/if}

  {#if searchData.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination bind:page={params.page} pageSize={params.pageSize} count={searchData.totalCount} size="sm" />
      </div>
    </div>
  {/if}
</div>

<BulkDeleteObjectsModal
  bind:isOpen={showBulkDeleteModal}
  selectedIds={selectedObjects}
  on:deleted={() => (selectedObjects = [])}
/>

<BulkChangeInstitutionModal
  bind:isOpen={showBulkInstitutionModal}
  projectId={project.id}
  selectedCount={selectedObjects.length}
  onConfirm={handleConfirmInstitution}
/>
<BulkEditObjectsModal bind:isOpen={showBulkEditModal} projectId={project.id} selectedIds={selectedObjects} researchFields={researchFields} onSaved={() => (selectedObjects = [])} />

{#if showAdvancedFilters}
  <ObjectAdvancedFilters
    researchFields={getFieldList(researchFields)}
    ontologyFields={getFieldList(ontologyFields)}
    institutions={getFieldList(institutions)}
    {vocabularies}
    bind:advancedFilters
    facets={searchData.facets || {}}
    onClose={() => (showAdvancedFilters = false)}
    {onFiltersChange}
  />
{/if}
