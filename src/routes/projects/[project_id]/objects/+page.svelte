<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import ObjectCard from "$lib/components/objects/ObjectCard.svelte";
  import ObjectsTable from "$lib/components/objects/ObjectsTable.svelte";
  import InstitutionObjectsFields from "$lib/components/institutions/InstitutionObjectsFields.svelte";
  import ObjectAdvancedFilters from "$lib/components/objects/ObjectAdvancedFilters.svelte";
  import BulkDeleteObjectsModal from "$lib/components/objects/BulkDeleteObjectsModal.svelte";
  import BulkChangeInstitutionModal from "$lib/components/objects/BulkChangeInstitutionModal.svelte";
  import BulkActionsStatusSelect from "$lib/components/objects/BulkActionsStatusSelect.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { topCurtainOverlay } from "$lib/utils/transitions.js";
  import { queryParameters, ssp } from "sveltekit-search-params";
  import { updateObjectsStatusBulk, updateObjectsInstitutionBulk } from "$lib/stores/ObjectsUtils.js";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { watch } from "runed";

  const { t } = getTranslationStore();
  const { data } = $props();

  // Query parameters
  const params = queryParameters({
    view: ssp.string("objects"),
    viewAs: ssp.string("grid"),
    pageSize: { encode: (v) => v.toString(), decode: (v) => (v ? parseInt(v) : null), defaultValue: 25 },
    page: { encode: (v) => v.toString(), decode: (v) => (v ? parseInt(v) : null), defaultValue: 1 },
    orderBy: ssp.string("updated_at"),
    direction: ssp.string("asc"),
    search: ssp.string(undefined),
    searchField: { encode: (v) => (v === "all" ? undefined : v), decode: (v) => v || "all", defaultValue: "all" },
    status: { encode: (v) => (v === "all" ? undefined : v), decode: (v) => v || "all", defaultValue: undefined },
    filters: {
      encode: (v) => {
        try {
          if (!v || Object.keys(v).length === 0) return undefined;
          return encodeURIComponent(JSON.stringify(v));
        } catch (e) {
          console.warn("Failed to encode filters", e);
          return undefined;
        }
      },
      decode: (v) => {
        try {
          return v ? JSON.parse(decodeURIComponent(v)) : {};
        } catch (e) {
          console.warn("Failed to decode filters", e);
          return {};
        }
      },
      defaultValue: undefined,
    },
  });

  // State
  let searchText = $state(params.search || "");
  let selectedObjects = $state([]);
  let bulkStatusValue = $state("");
  let showAdvancedFilters = $state(false);
  let advancedFilters = $state(params.filters || {});
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);

  // Derived
  const projectId = $derived($page.params.project_id);
  const paramsBinding = $derived({ current: params });
  const searchData = $derived(data.objects || { items: [], totalCount: 0, facets: {} });
  const displayFields = $derived(data.displayFields);
  const researchFields = $derived(data.researchFields);
  const listQuery = $derived($page.url.search || "");
  const viewAs = $derived(params.viewAs || "grid");

  const ontologyFieldsList = $derived.by(() => [
    { value: "name", label: t("common.name", { fallback: "Name" }) },
    { value: "all", label: t("common.all", { fallback: "All" }) },
    ...data.ontologyFields.result.map((f) => ({ value: f.id, label: f.name.content })),
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

  const vocabularies = $derived.by(() => {
    const arr = [];
    (researchFields?.result || researchFields || []).forEach((f) => {
      if ((f.type || "").toLowerCase() === "vocabulary") {
        (f.vocabularies || []).forEach((v) => {
          arr.push({ id: v.id, field_id: f.id, name: v.option?.content || v.option });
        });
      }
    });
    return arr;
  });

  // Lookup maps
  const createLookupMap = (items, getId, getName) => {
    const map = new Map();
    items.forEach((item) => map.set(String(getId(item)), getName(item)));
    return map;
  };

  const institutionsById = $derived(
    createLookupMap(
      data.institutions?.result || data.institutions || [],
      (i) => i.id,
      (i) => i.name?.content || i.name || String(i.id)
    )
  );

  const researchFieldsById = $derived(
    createLookupMap(
      researchFields?.result || researchFields || [],
      (f) => f.id,
      (f) => f.name?.content || f.name || String(f.id)
    )
  );

  const ontologyFieldsById = $derived(
    createLookupMap(
      data.ontologyFields?.result || data.ontologyFields || [],
      (f) => f.id,
      (f) => f.name?.content || f.name || String(f.id)
    )
  );

  const vocabularyFieldIds = $derived.by(() => {
    const set = new Set();
    (researchFields?.result || researchFields || []).forEach((f) => {
      if (String(f.type || "").toLowerCase() === "vocabulary") set.add(String(f.id));
    });
    return set;
  });

  const vocabById = $derived(
    createLookupMap(vocabularies, (v) => v.id, (v) => v.name)
  );

  const hasAppliedFilters = $derived.by(() => {
    const hasStatus = params.status && params.status !== "all";
    const hasSearch = params.search && params.search.trim().length > 0;
    const hasInstitutions = (advancedFilters?.institutions || []).length > 0;
    const hasVocabSelections = Object.entries(advancedFilters || {}).some(
      ([key, val]) => key !== "__textFilters" && Array.isArray(val) && val.length > 0
    );
    const hasTextFilters = (advancedFilters?.__textFilters || []).length > 0;
    return hasStatus || hasSearch || hasInstitutions || hasVocabSelections || hasTextFilters;
  });

  // Translation strings
  const i18n = $derived({
    objects: t("common.objects", { fallback: "Objects" }),
    clearSelection: t("common.clear-selection", { fallback: "Clear selection" }),
    changeInstitution: t("common.change-institution", { fallback: "Change institution" }),
    status: t("common.status", { fallback: "Status" }),
    editSelected: t("objects.edit-selected", { fallback: "Edit selected" }),
    deleteSelected: t("common.delete-selected", { fallback: "Delete" }),
    search: t("common.search", { fallback: "Search" }),
    searchObjects: t("objects.search-objects", { fallback: "Search objects" }),
    selectFields: t("objects.select-fields", { fallback: "Select fields" }),
    viewAs: t("objects.view-as", { fallback: "View as" }),
    filter: t("common.filter", { fallback: "Filter" }),
    addNew: t("menu.add-object", { fallback: "Add Object" }),
    clearFilters: t("common.clear-filters", { fallback: "Clear filters" }),
    noObjectsFound: t("objects.no-objects-found", { fallback: "No objects found" }),
  });

  const filterBadges = $derived.by(() => {
    const badges = [];
    const addBadge = (text, onClear) => badges.push({ text, onClear });
    const clearParam = (param, value) => () => { params[param] = value; params.page = 1; };
    const clearFilterArray = (key, filterFn) => () => {
      advancedFilters = { ...advancedFilters, [key]: advancedFilters[key]?.filter(filterFn) || [] };
      params.filters = advancedFilters;
      params.page = 1;
    };

    // Status
    if (params.status && params.status !== "all") {
      const label = statuses.find((s) => s.value === params.status)?.label || params.status;
      addBadge(`${t("common.status", { fallback: "Status" })}: ${label}`, clearParam("status", "all"));
    }

    // Search
    if (params.search?.trim()) {
      const fieldLabel = ontologyFieldsList.find((o) => o.value === params.searchField)?.label || t("common.search", { fallback: "Search" });
      addBadge(`${fieldLabel}: ${params.search}`, clearParam("search", ""));
    }

    // Institutions
    (advancedFilters?.institutions || []).forEach((instId) => {
      const name = institutionsById.get(String(instId)) || String(instId);
      addBadge(
        `${t("common.institution", { fallback: "Institution" })}: ${name}`,
        clearFilterArray("institutions", (id) => String(id) !== String(instId))
      );
    });

    // Vocabularies
    Object.entries(advancedFilters || {})
      .filter(([key, val]) => key !== "__textFilters" && key !== "institutions" && Array.isArray(val) && val.length > 0 && vocabularyFieldIds.has(String(key)))
      .forEach(([fieldId, ids]) => {
        const fieldName = researchFieldsById.get(String(fieldId)) || String(fieldId);
        ids.forEach((vocabId) => {
          const optionName = vocabById.get(String(vocabId)) || String(vocabId);
          addBadge(
            `${fieldName}: ${optionName}`,
            clearFilterArray(fieldId, (id) => String(id) !== String(vocabId))
          );
        });
      });

    // Text filters
    (advancedFilters?.__textFilters || []).forEach((tf) => {
      const fieldName = tf.kind === "research"
        ? researchFieldsById.get(String(tf.fieldId))
        : ontologyFieldsById.get(String(tf.fieldId));
      addBadge(
        `${fieldName || String(tf.fieldId)}: ${tf.query}`,
        () => {
          advancedFilters = {
            ...advancedFilters,
            __textFilters: advancedFilters.__textFilters?.filter((x) => !(x.kind === tf.kind && String(x.fieldId) === String(tf.fieldId))) || []
          };
          params.filters = advancedFilters;
          params.page = 1;
        }
      );
    });

    return badges;
  });

  // Watch for param changes and sync search text
  watch(
    () => params.search,
    (newSearch) => {
      searchText = newSearch || "";
    }
  );

  // Watch for navigation changes to sync filters
  watch(
    () => params.filters,
    (newFilters) => {
      advancedFilters = newFilters || {};
    }
  );

  // Handlers
  const clearSelection = () => (selectedObjects = []);
  const confirmBulkDelete = () => (showBulkDeleteModal = true);
  const openBulkInstitutionModal = () => (showBulkInstitutionModal = true);
  const handleDeleted = () => (selectedObjects = []);
  const handleFiltersClick = () => (showAdvancedFilters = true);
  const closeAdvancedFilters = () => (showAdvancedFilters = false);

  const onFiltersChange = () => {
    advancedFilters = { ...advancedFilters };
    params.filters = advancedFilters;
    params.page = 1;
  };

  const handleSearchInput = (e) => {
    searchText = e.target.value;
    params.searchField = "all";
    params.search = searchText;
    params.page = 1;
  };

  const openBulkEdit = () => {
    if (!selectedObjects?.length) return;
    const ids = selectedObjects.map(String).join(",");
    const returnTo = `/projects/${projectId}/objects`;
    goto(`/projects/${projectId}/objects/bulk-edit?ids=${encodeURIComponent(ids)}&returnTo=${encodeURIComponent(returnTo)}`);
  };

  const applyBulkStatus = async () => {
    if (!bulkStatusValue || selectedObjects.length === 0) return;
    const { errors } = await updateObjectsStatusBulk(selectedObjects, bulkStatusValue);
    if (errors?.length) console.error("Bulk status update had errors:", errors);
    selectedObjects = [];
    bulkStatusValue = "";
  };

  const handleConfirmInstitution = async ({ institutionId }) => {
    if (!institutionId || selectedObjects.length === 0) {
      showBulkInstitutionModal = false;
      return;
    }
    const { errors } = await updateObjectsInstitutionBulk(selectedObjects, institutionId);
    if (errors?.length) console.error("Bulk institution update had errors:", errors);
    selectedObjects = [];
    showBulkInstitutionModal = false;
  };
</script>

<div class="container-fluid bg-light" style="min-height: 100%;">
  <div class="row pt-3 pb-3 border-bottom mb-4 align-items-center">
    <div class="col">
      <h2 class="m-0 d-flex align-items-center gap-2">
        <i class="bi bi-box text-muted"></i>
        {i18n.objects}
      </h2>
    </div>
  </div>
  <div class="position-relative mb-3">
    <div class="row align-items-center">
      <div class="col-3">
        <BaseInput
          icon="search"
          placeholder={i18n.search}
          clearable
          size="sm"
          bind:value={searchText}
          onInput={handleSearchInput}
        />
      </div>
      <div class="col-9 d-flex justify-content-end gap-3 align-items-center mb-1">
        <a class="btn btn-secondary btn-sm" href="/projects/{data.project.id}/objects/add">
          <i class="bi bi-plus-lg"></i>
          {i18n.addNew}
        </a>
      </div>
    </div>

    <div class="position-relative">
      <div class="row align-items-center g-2 pb-2 mt-2">
        <div class="col-auto">
          {searchData.totalCount}
          {searchData.totalCount === 1 ? t("common.object", { fallback: "object" }) : t("common.objects", { fallback: "objects" })}
        </div>
        <div class="col d-flex justify-content-end gap-2 flex-wrap">
          <BaseSelect items={statuses} bind:value={params.status} as="button" inputClass="btn-light btn-sm border">
            <i class="bi bi-chevron-down"></i>
          </BaseSelect>
          <BaseSelect items={sortOptions} bind:value={params.orderBy} as="button" inputClass="btn-light btn-sm border">
            <i class="bi bi-chevron-down"></i>
          </BaseSelect>
          <InstitutionObjectsFields
            {displayFields}
            {researchFields}
            projectId={data.project.id}
            as="button"
            inputClass="btn-light btn-sm border"
          />
          <button type="button" class="btn btn-light btn-sm border" onclick={handleFiltersClick}>
            <i class="bi bi-filter"></i>
            {i18n.filter}
          </button>
          <div class="btn-group btn-group-sm" role="group" aria-label={t("common.view-as", { fallback: "View as" })}>
            {#each [{ val: "grid", icon: "grid-3x3-gap", label: t("common.grid-view", { fallback: "Grid" }) }, { val: "table", icon: "list", label: t("common.table-view", { fallback: "Table" }) }] as view}
              <button
                type="button"
                class="btn btn-light border"
                class:active={viewAs === view.val}
                onclick={() => (params.viewAs = view.val)}
                aria-label={view.label}
              >
                <i class="bi bi-{view.icon}"></i>
              </button>
            {/each}
          </div>
        </div>
      </div>

      {#if selectedObjects.length > 0}
        <div
          transition:topCurtainOverlay={{ y: -20, duration: 220 }}
          class="position-absolute top-0 start-0 end-0 bottom-0 z-2 bg-light"
        >
          <div class="row align-items-center g-2 pb-2 mt-2 h-100">
            <div class="col d-flex align-items-center gap-2 flex-wrap">
              <button class="btn btn-secondary btn-sm d-flex align-items-center gap-2" onclick={clearSelection}>
                <span>{i18n.clearSelection}</span>
                <i class="bi bi-x-circle"></i>
              </button>
              <button class="btn btn-secondary btn-sm d-flex align-items-center gap-2" onclick={openBulkInstitutionModal}>
                <span>{i18n.changeInstitution}</span>
                <i class="bi bi-bank"></i>
              </button>
              <BulkActionsStatusSelect
                items={statuses.filter((s) => s.value !== "all")}
                bind:value={bulkStatusValue}
                onValueChange={applyBulkStatus}
              />
              <button class="btn btn-secondary btn-sm d-flex align-items-center gap-2" onclick={openBulkEdit}>
                <span>{i18n.editSelected}</span>
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-danger btn-sm d-flex align-items-center gap-2" onclick={confirmBulkDelete}>
                <span>{i18n.deleteSelected}</span>
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
  {#if hasAppliedFilters}
    <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
      {#each filterBadges as b}
        <span class="badge rounded-pill text-bg-secondary d-flex align-items-center gap-1">
          <span class="text-truncate" style="max-width: 240px;">{b.text}</span>
          <button class="btn btn-sm btn-link text-white p-0 m-0" aria-label={t("common.remove", { fallback: "Remove" })} onclick={b.onClear}>
            <i class="bi bi-x-lg"></i>
          </button>
        </span>
      {/each}
    </div>
  {/if}
  {#if searchData.totalCount}
    {#key displayFields}
      {#if viewAs === "grid"}
        <div class="row">
          {#each searchData.items as object (object.id)}
            <div class="col-3">
              <ObjectCard {object} {displayFields} displayInstitution={true} bind:selected={selectedObjects} listQuery={listQuery} />
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
          listQuery={listQuery}
        />
      {/if}
    {/key}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {i18n.noObjectsFound}
    </div>
  {/if}
  {#if searchData.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination
          bind:page={params.page}
          pageSize={params.pageSize}
          count={searchData.totalCount}
          size="sm"
        />
      </div>
    </div>
  {/if}

  <!-- Bulk Delete Confirmation Modal (Reusable Component) -->
  <BulkDeleteObjectsModal
    bind:isOpen={showBulkDeleteModal}
    selectedIds={selectedObjects}
    on:deleted={handleDeleted}
  />

  <!-- Bulk Change Institution Modal (Reusable Component) -->
  <BulkChangeInstitutionModal
    bind:isOpen={showBulkInstitutionModal}
    {projectId}
    onConfirm={handleConfirmInstitution}
  />

  {#if showAdvancedFilters}
    <ObjectAdvancedFilters
      researchFields={researchFields?.result || researchFields || []}
      ontologyFields={data.ontologyFields?.result || data.ontologyFields || []}
      institutions={data.institutions?.result || data.institutions || []}
      {vocabularies}
      bind:advancedFilters
      facets={searchData?.facets || {}}
      onClose={closeAdvancedFilters}
      {onFiltersChange}
    />
  {/if}
</div>
