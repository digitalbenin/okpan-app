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
  import { fly } from "svelte/transition";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { queryParameters, ssp } from "sveltekit-search-params";
  import {
    updateObjectsStatusBulk,
    updateObjectsInstitutionBulk,
    searchObjects,
  } from "$lib/stores/ObjectsUtils.js";
  import { page } from "$app/stores";

  const { t } = getTranslationStore();

  const { data } = $props();
  const paramsOptions = {
    view: ssp.string("objects"),
    pageSize: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 25,
    },
    page: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    orderBy: ssp.string("updated_at"),
    direction: ssp.string("asc"),
    search: ssp.string(undefined),
    searchField: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: "name",
    },
    status: {
      encode: (value) => (value === "all" ? undefined : value),
      decode: (value) => (value ? value : "all"),
      defaultValue: undefined,
    },
  };
  const params = queryParameters(paramsOptions);

  let paramsBinding = $derived({ current: params }); //workaround for SvelteKit's reactivity issue with query parameters

  let viewAs = $state("grid");
  let selectedObjects = $state([]);
  let bulkStatusValue = $state("");
  let showAdvancedFilters = $state(false);
  let advancedFilters = $state({});

  // Client-side search results (items + facets)
  let searchData = $state({
    items: [],
    totalCount: 0,
    facets: { institutions: [], statuses: [], researchFields: [] },
  });

  // Modal state
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);

  // Project id from route params
  const projectId = $derived($page.params.project_id);

  // Use store utilities for mutations and cache invalidation

  const viewAsOptions = $derived([
    { value: "grid", label: t("common.grid-view", { fallback: "Grid" }) },
    { value: "table", label: t("common.table-view", { fallback: "Table" }) },
  ]);

  const ontologyFieldsList = $derived.by(() => {
    return [
      {
        value: "name",
        label: t("common.name", { fallback: "Name" }),
      },
      {
        value: "all",
        label: t("common.all", { fallback: "All" }),
      },
      ...data.ontologyFields.result.map((field) => ({
        value: field.id,
        label: field.name.content,
      })),
    ];
  });
  // removed unused orderBy options

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

  // Flatten vocabularies for AdvancedFilters component
  const vocabularies = $derived.by(() => {
    const arr = [];
    (data.researchFields?.result || data.researchFields || []).forEach((f) => {
      if ((f.type || "").toLowerCase() === "vocabulary") {
        (f.vocabularies || []).forEach((v) => {
          arr.push({
            id: v.id,
            field_id: f.id,
            name: v.option?.content || v.option,
          });
        });
      }
    });
    return arr;
  });

  function clearSelection() {
    selectedObjects = [];
  }

  function confirmBulkDelete() {
    showBulkDeleteModal = true;
  }

  function openBulkInstitutionModal() {
    showBulkInstitutionModal = true;
  }

  function openBulkEdit() {
    if (!selectedObjects?.length) return;
    const ids = selectedObjects.map(String).join(",");
    const returnTo = `/projects/${projectId}/objects`;
    const url = `/projects/${projectId}/objects/bulk-edit?ids=${encodeURIComponent(ids)}&returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = url;
  }

  // Clear selection after modal emits deleted event
  function handleDeleted() {
    selectedObjects = [];
  }

  function handleFiltersClick() {
    showAdvancedFilters = true;
  }
  function closeAdvancedFilters() {
    showAdvancedFilters = false;
  }
  function onFiltersChange() {
    advancedFilters = { ...advancedFilters };
    console.debug("Advanced filters changed", advancedFilters);
    void loadObjects();
  }
  async function applyBulkStatus() {
    if (!bulkStatusValue || selectedObjects.length === 0) return;
    const { errors } = await updateObjectsStatusBulk(
      selectedObjects,
      bulkStatusValue,
    );
    if (errors && errors.length) {
      console.error("Bulk status update had errors:", errors);
    }
    selectedObjects = [];
    bulkStatusValue = "";
  }

  async function handleConfirmInstitution({ institutionId }) {
    if (!institutionId || selectedObjects.length === 0) {
      showBulkInstitutionModal = false;
      return;
    }
    const { errors } = await updateObjectsInstitutionBulk(
      selectedObjects,
      institutionId,
    );
    if (errors && errors.length) {
      console.error("Bulk institution update had errors:", errors);
    }
    selectedObjects = [];
    showBulkInstitutionModal = false;
  }
  // removed debug inspect

  // Lookup maps for labels
  const institutionsById = $derived.by(() => {
    const list = data.institutions?.result || data.institutions || [];
    const m = new Map();
    for (const inst of list) {
      m.set(
        String(inst.id),
        inst.name?.content || inst.name || String(inst.id),
      );
    }
    return m;
  });
  const researchFieldsById = $derived.by(() => {
    const list = data.researchFields?.result || data.researchFields || [];
    const m = new Map();
    for (const f of list) {
      m.set(String(f.id), f.name?.content || f.name || String(f.id));
    }
    return m;
  });
  const vocabularyFieldIds = $derived.by(() => {
    const list = data.researchFields?.result || data.researchFields || [];
    const set = new Set();
    for (const f of list) {
      const fType = String(f.type || "").toLowerCase();
      if (fType === "vocabulary") set.add(String(f.id));
    }
    return set;
  });
  const ontologyFieldsById = $derived.by(() => {
    const list = data.ontologyFields?.result || data.ontologyFields || [];
    const m = new Map();
    for (const f of list) {
      m.set(String(f.id), f.name?.content || f.name || String(f.id));
    }
    return m;
  });
  const vocabById = $derived.by(() => {
    const m = new Map();
    for (const v of vocabularies) {
      m.set(String(v.id), v.name);
    }
    return m;
  });

  // Detect if any filters are currently applied
  const hasAppliedFilters = $derived.by(() => {
    const hasStatus = params.status && params.status !== "all";
    const hasSearch = params.search && params.search.trim().length > 0;
    const hasInstitutions = (advancedFilters?.institutions || []).length > 0;
    const hasVocabSelections = Object.entries(advancedFilters || {}).some(
      ([key, val]) =>
        key !== "__textFilters" && Array.isArray(val) && val.length > 0,
    );
    const hasTextFilters = (advancedFilters?.__textFilters || []).length > 0;
    return (
      hasStatus ||
      hasSearch ||
      hasInstitutions ||
      hasVocabSelections ||
      hasTextFilters
    );
  });

  // Build badges for each applied filter with individual clear handlers
  const filterBadges = $derived.by(() => {
    const badges = [];

    // Status badge
    if (params.status && params.status !== "all") {
      const label =
        statuses.find((s) => s.value === params.status)?.label || params.status;
      badges.push({
        text: `${t("common.status", { fallback: "Status" })}: ${label}`,
        onClear: () => {
          params.status = "all";
          params.page = 1;
          void loadObjects();
        },
      });
    }

    // Search badge
    if (params.search && params.search.trim()) {
      const fieldLabel =
        ontologyFieldsList.find((o) => o.value === params.searchField)?.label ||
        t("common.search", { fallback: "Search" });
      badges.push({
        text: `${fieldLabel}: ${params.search}`,
        onClear: () => {
          params.search = "";
          params.page = 1;
          void loadObjects();
        },
      });
    }

    // Institution badges
    for (const instId of advancedFilters?.institutions || []) {
      const name = institutionsById.get(String(instId)) || String(instId);
      badges.push({
        text: `${t("common.institution", { fallback: "Institution" })}: ${name}`,
        onClear: () => {
          const next = (advancedFilters?.institutions || []).filter(
            (id) => String(id) !== String(instId),
          );
          advancedFilters = { ...advancedFilters, institutions: next };
          params.page = 1;
          void loadObjects();
        },
      });
    }

    // Vocabulary selections per research field
    const rfSelections = Object.entries(advancedFilters || {}).filter(
      ([key, val]) => {
        // Only include research field vocabulary selections; skip institutions and text filters
        if (key === "__textFilters" || key === "institutions") return false;
        return (
          Array.isArray(val) &&
          val.length > 0 &&
          vocabularyFieldIds.has(String(key))
        );
      },
    );
    for (const [fieldId, ids] of rfSelections) {
      const fieldName =
        researchFieldsById.get(String(fieldId)) || String(fieldId);
      for (const vocabId of ids) {
        const optionName = vocabById.get(String(vocabId)) || String(vocabId);
        badges.push({
          text: `${fieldName}: ${optionName}`,
          onClear: () => {
            const nextIds = (advancedFilters?.[fieldId] || []).filter(
              (id) => String(id) !== String(vocabId),
            );
            const next = { ...advancedFilters };
            next[fieldId] = nextIds;
            advancedFilters = next;
            params.page = 1;
            void loadObjects();
          },
        });
      }
    }

    // Text filters (research + ontology) from advanced filters
    for (const tf of advancedFilters?.__textFilters || []) {
      const isResearch = tf.kind === "research";
      const fieldName = isResearch
        ? researchFieldsById.get(String(tf.fieldId)) || String(tf.fieldId)
        : ontologyFieldsById.get(String(tf.fieldId)) || String(tf.fieldId);
      badges.push({
        text: `${fieldName}: ${tf.query}`,
        onClear: () => {
          const nextText = (advancedFilters?.__textFilters || []).filter(
            (x) =>
              !(
                String(x.kind) === String(tf.kind) &&
                String(x.fieldId) === String(tf.fieldId)
              ),
          );
          const next = { ...advancedFilters, __textFilters: nextText };
          advancedFilters = next;
          params.page = 1;
          void loadObjects();
        },
      });
    }

    return badges;
  });

  // generic search can combine with advanced filters

  // Build and execute faceted search using current params and advanced filters
  async function loadObjects() {
    try {
      const opts = {
        projectId: projectId,
        page: (params.page || 1) - 1,
        pageSize: params.pageSize || 25,
        orderBy: paramsBinding.current.orderBy || "updated_at",
        direction: paramsBinding.current.direction || "asc",
      };

      // Status filter
      if (params.status && params.status !== "all") {
        opts.status = params.status;
      }

      // Institution filter from advanced panel
      const instIds = (advancedFilters?.institutions || []).filter(Boolean);
      if (instIds.length) {
        opts.institutionIds = instIds;
      }

      // Research field filters (vocabularies + text queries on non-vocab fields)
      const rfList = data.researchFields?.result || data.researchFields || [];
      const researchFieldFilters = [];
      rfList.forEach((f) => {
        const fType = String(f.type || "").toLowerCase();
        const sel = advancedFilters?.[f.id] || [];
        if (fType === "vocabulary" && sel.length) {
          researchFieldFilters.push({ fieldId: f.id, vocabularyIds: sel });
        } else if (fType !== "vocabulary") {
          const tf = (advancedFilters?.__textFilters || []).find(
            (x) => x.kind === "research" && String(x.fieldId) === String(f.id),
          );
          if (tf?.query && tf.query.trim()) {
            researchFieldFilters.push({ fieldId: f.id, query: tf.query });
          }
        }
      });
      if (researchFieldFilters.length) {
        opts.researchFieldFilters = researchFieldFilters;
      }

      // Ontology field text queries
      const ontologyFieldQueries = (advancedFilters?.__textFilters || [])
        .filter((x) => x.kind === "ontology" && x.query && x.query.trim())
        .map((x) => ({ fieldId: x.fieldId, query: x.query }));

      // Top search input behavior:
      // - If specific field chosen, map to ontologyFieldQueries
      // - If "all" chosen, use genericQuery for backend to OR across name/fields
      if (params.search && params.search.trim()) {
        const sf = params.searchField;
        if (sf && sf !== "all") {
          ontologyFieldQueries.push({ fieldId: sf, query: params.search });
        } else if (sf === "all") {
          opts.genericQuery = params.search;
        }
      }
      if (ontologyFieldQueries.length) {
        opts.ontologyFieldQueries = ontologyFieldQueries;
      }

      const result = await searchObjects(opts);
      searchData = {
        items: result.items || [],
        totalCount: result.totalCount || 0,
        facets: result.facets || {
          institutions: [],
          statuses: [],
          researchFields: [],
        },
      };
    } catch (e) {
      console.error("Failed to load objects via faceted search:", e);
      searchData = {
        items: [],
        totalCount: 0,
        facets: { institutions: [], statuses: [], researchFields: [] },
      };
    }
  }

  // Reactive search: run whenever params or filters change
  $effect(() => {
    // track dependencies explicitly for reactivity
    params.search;
    params.searchField;
    params.status;
    paramsBinding.current.orderBy;
    paramsBinding.current.direction;
    params.page;
    params.pageSize;
    advancedFilters;
    projectId;
    void loadObjects();
  });
</script>

<div class="container-fluid">
  <div class="row my-3">
    <div class="col-12">
      <h1>
        <i class="bi bi-box"></i>
        {t("common.objects", { fallback: "Objects" })}
      </h1>
    </div>
  </div>
  <div
    class="row align-items-center mb-3 position-relative overflow-hidden py-2"
  >
    {#if selectedObjects.length > 0}
      <div
        transition:fly={{ opacity: 1, y: -35 }}
        class="d-flex align-items-center px-3 gap-2 position-absolute top-0 start-0 end-0 bottom-0 z-1 bg-white border-bottom"
      >
        <div class="fw-bold">
          {selectedObjects.length}
          {t("common.selected-objects", {
            fallback: "selected objects",
          })}
        </div>
        <button
          class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
          onclick={clearSelection}
        >
          <span>
            {t("common.clear-selection", {
              fallback: "Clear selection",
            })}
          </span>
          <i class="bi bi-x-circle"></i>
        </button>
        <button
          class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
          onclick={openBulkInstitutionModal}
        >
          <span>
            {t("common.change-institution", {
              fallback: "Change institution",
            })}
          </span>
          <i class="bi bi-bank"></i>
        </button>
        <BulkActionsStatusSelect
          items={statuses.filter((s) => s.value !== "all")}
          bind:value={bulkStatusValue}
          onValueChange={applyBulkStatus}
        />
        <button
          class="btn btn-secondary btn-sm d-flex align-items-center gap-2"
          onclick={openBulkEdit}
        >
          <span>
            {t("common.edit-information", {
              fallback: "Edit information",
            })}
          </span>
          <i class="bi bi-pencil"></i>
        </button>
        <div class="ms-auto">
          <button
            class="btn btn-danger btn-sm d-flex align-items-center gap-2"
            onclick={confirmBulkDelete}
          >
            <span>
              {t("common.delete", {
                fallback: "Delete",
              })}
            </span>
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    {/if}
    <div class="col-4">
      <BaseInput
        icon="search"
        placeholder={t("common.search", { fallback: "Search" })}
        size="sm"
        bind:value={params.search}
        optionsList={ontologyFieldsList}
        bind:optionsValue={params.searchField}
      />
    </div>
    <div class="col-8 d-flex justify-content-end gap-3 align-items-center">
      <!-- <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.order-by", { fallback: "Order by" })}
        </div>
        <BaseSelect items={orderBy} bind:value={params.orderBy} size="sm"
        ></BaseSelect>
      </div> -->
      <div class="d-flex align-items-center text-truncate gap-2">
        <div class="col-auto fs-7">
          {t("common.select-fields", { fallback: "Select Fields" })}
        </div>
        <InstitutionObjectsFields
          displayFields={data.displayFields}
          researchFields={data.researchFields}
          projectId={data.project.id}
        />
      </div>

      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.status", { fallback: "Status" })}
        </div>
        <BaseSelect items={statuses} bind:value={params.status} size="sm"
        ></BaseSelect>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.view-as", { fallback: "View as" })}
        </div>
        <BaseSelect items={viewAsOptions} bind:value={viewAs} size="sm"
        ></BaseSelect>
      </div>
      <button
        type="button"
        class="btn btn-outline-primary btn-sm"
        onclick={handleFiltersClick}
      >
        <i class="bi bi-filter"></i>
        {t("common.filter", { fallback: "Filter" })}
      </button>
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{data.project.id}/objects/add"
        ><i class="bi bi-plus-lg"></i>
        {t("common.add-object", { fallback: "Add Object" })}</a
      >
    </div>
  </div>
  {#if searchData.totalCount}
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        {searchData.totalCount}
        {#if searchData.totalCount > 1}
          {t("common.objects", { fallback: "objects" })}
        {:else}
          {t("common.object", { fallback: "object" })}
        {/if}
      </div>
      {#if hasAppliedFilters}
        <div
          class="d-flex align-items-center justify-content-end gap-2 flex-wrap"
        >
          {#each filterBadges as b}
            <span
              class="badge rounded-pill text-bg-secondary d-flex align-items-center gap-1"
            >
              <span class="text-truncate" style="max-width: 240px;"
                >{b.text}</span
              >
              <button
                class="btn btn-sm btn-link text-white p-0 m-0"
                aria-label={t("common.remove", { fallback: "Remove" })}
                onclick={b.onClear}
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </span>
          {/each}
        </div>
      {/if}
    </div>
    {#if viewAs === "grid"}
      <div class="row">
        {#each searchData.items as object (object.id)}
          <div class="col-4">
            <ObjectCard
              {object}
              displayFields={data.displayFields}
              displayInstitution={true}
            />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <ObjectsTable
        items={searchData.items}
        bind:orderBy={paramsBinding.current.orderBy}
        bind:direction={paramsBinding.current.direction}
        bind:selectedObjects
        displayFields={data.displayFields}
        displayInstitution={true}
      ></ObjectsTable>
    {/if}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {t("common.no-objects-found", {
        fallback: "No objects found.",
      })}
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
      researchFields={data.researchFields?.result || data.researchFields || []}
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
