<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import ObjectCard from "$lib/components/objects/ObjectCard.svelte";
  import ObjectsTable from "$lib/components/objects/ObjectsTable.svelte";
  import InstitutionObjectsFields from "$lib/components/institutions/InstitutionObjectsFields.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { fly } from "svelte/transition";
  import BulkDeleteObjectsModal from "$lib/components/objects/BulkDeleteObjectsModal.svelte";
  import BulkChangeInstitutionModal from "$lib/components/objects/BulkChangeInstitutionModal.svelte";
  import BulkActionsStatusSelect from "$lib/components/objects/BulkActionsStatusSelect.svelte";
  import ObjectAdvancedFilters from "$lib/components/objects/ObjectAdvancedFilters.svelte";

  import {
    updateObjectsStatusBulk,
    updateObjectsInstitutionBulk,
    searchObjects,
  } from "$lib/stores/ObjectsUtils.js";

  let {
    institution,
    objects,
    ontologyFields,
    researchFields,
    displayFields,
    params = $bindable(),
  } = $props();

  const { t, translationState } = getTranslationStore();

  let viewAs = $state("grid");
  let selectedObjects = $state([]);
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);
  let bulkStatusValue = $state("");
  let showAdvancedFilters = $state(false);
  let advancedFilters = $state({});

  // Client-side search results for institution context
  let objectsData = $state({
    items: [],
    totalCount: 0,
    facets: { institutions: [], statuses: [], researchFields: [] },
  });

  const viewAsOptions = $derived([
    { value: "grid", label: t("common.grid-view", { fallback: "Grid" }) },
    { value: "table", label: t("common.table-view", { fallback: "Table" }) },
  ]);

  const ontologyFieldsList = $derived.by(() => {
    return [
      {
        value: "all",
        label: t("common.all", { fallback: "All" }),
      },
      ...ontologyFields.result.map((field) => ({
        value: field.id,
        label: field.name.content,
      })),
    ];
  });

  const orderBy = $derived([
    // { value: "name", label: t("common.name", { fallback: "Name" }) },
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

  // Label helpers for badges
  const ontologyFieldsLabelById = $derived.by(() => {
    const map = {};
    (ontologyFieldsList || []).forEach((f) => {
      map[String(f.value)] = f.label;
    });
    return map;
  });

  const activeStatusLabel = $derived.by(() => {
    const s = (statuses || []).find((x) => x.value === (params.oStatus || "all"));
    return s?.label || t("common.all", { fallback: "All" });
  });

  const activeSearchFieldLabel = $derived.by(() => {
    const id = params.oSearchField || "all";
    return ontologyFieldsLabelById[String(id)] || t("common.all", { fallback: "All" });
  });

  const advancedFiltersCount = $derived.by(() => {
    let count = 0;
    const af = advancedFilters || {};
    Object.entries(af).forEach(([key, val]) => {
      if (key === "__textFilters") return;
      if (Array.isArray(val) && val.length) count += val.length;
    });
    count += (af.__textFilters || []).filter((tf) => tf?.query && String(tf.query).trim()).length;
    return count;
  });

  function clearStatusFilter() {
    params.oStatus = "all";
    params.oPage = 1;
  }

  function clearSearchFilter() {
    params.oSearch = undefined;
    params.oSearchField = "all";
    params.oPage = 1;
  }

  function clearAllAdvancedFilters() {
    advancedFilters = {};
    params.oPage = 1;
  }

  // Flatten vocabularies for AdvancedFilters component
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

  // Match objects page: lookup maps and badges
  const researchFieldsById = $derived.by(() => {
    const list = researchFields?.result || researchFields || [];
    const m = new Map();
    for (const f of list) {
      m.set(String(f.id), f.name?.content || f.name || String(f.id));
    }
    return m;
  });
  const vocabularyFieldIds = $derived.by(() => {
    const list = researchFields?.result || researchFields || [];
    const set = new Set();
    for (const f of list) {
      const fType = String(f.type || "").toLowerCase();
      if (fType === "vocabulary") set.add(String(f.id));
    }
    return set;
  });
  const ontologyFieldsById = $derived.by(() => {
    const list = ontologyFields?.result || ontologyFields || [];
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

  const hasAppliedFilters = $derived.by(() => {
    const hasStatus = params.oStatus && params.oStatus !== "all";
    const hasSearch = params.oSearch && params.oSearch.trim().length > 0;
    const hasVocabSelections = Object.entries(advancedFilters || {}).some(
      ([key, val]) => key !== "__textFilters" && Array.isArray(val) && val.length > 0,
    );
    const hasTextFilters = (advancedFilters?.__textFilters || []).length > 0;
    return hasStatus || hasSearch || hasVocabSelections || hasTextFilters;
  });

  const filterBadges = $derived.by(() => {
    const badges = [];

    if (params.oStatus && params.oStatus !== "all") {
      const label = statuses.find((s) => s.value === params.oStatus)?.label || params.oStatus;
      badges.push({
        text: `${t("common.status", { fallback: "Status" })}: ${label}`,
        onClear: () => {
          params.oStatus = "all";
          params.oPage = 1;
          void loadObjects();
        },
      });
    }

    if (params.oSearch && params.oSearch.trim()) {
      const fieldLabel = (ontologyFieldsList || []).find((o) => o.value === params.oSearchField)?.label ||
        t("common.search", { fallback: "Search" });
      badges.push({
        text: `${fieldLabel}: ${params.oSearch}`,
        onClear: () => {
          params.oSearch = "";
          params.oPage = 1;
          void loadObjects();
        },
      });
    }

    const rfSelections = Object.entries(advancedFilters || {}).filter(([key, val]) => {
      if (key === "__textFilters") return false;
      return Array.isArray(val) && val.length > 0 && vocabularyFieldIds.has(String(key));
    });
    for (const [fieldId, ids] of rfSelections) {
      const fieldName = researchFieldsById.get(String(fieldId)) || String(fieldId);
      for (const vocabId of ids) {
        const optionName = vocabById.get(String(vocabId)) || String(vocabId);
        badges.push({
          text: `${fieldName}: ${optionName}`,
          onClear: () => {
            const nextIds = (advancedFilters?.[fieldId] || []).filter((id) => String(id) !== String(vocabId));
            const next = { ...advancedFilters };
            next[fieldId] = nextIds;
            advancedFilters = next;
            params.oPage = 1;
            void loadObjects();
          },
        });
      }
    }

    for (const tf of advancedFilters?.__textFilters || []) {
      const isResearch = tf.kind === "research";
      const fieldName = isResearch
        ? researchFieldsById.get(String(tf.fieldId)) || String(tf.fieldId)
        : ontologyFieldsById.get(String(tf.fieldId)) || String(tf.fieldId);
      badges.push({
        text: `${fieldName}: ${tf.query}`,
        onClear: () => {
          const nextText = (advancedFilters?.__textFilters || []).filter(
            (x) => !(String(x.kind) === String(tf.kind) && String(x.fieldId) === String(tf.fieldId)),
          );
          const next = { ...advancedFilters, __textFilters: nextText };
          advancedFilters = next;
          params.oPage = 1;
          void loadObjects();
        },
      });
    }

    return badges;
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

  function handleDeleted() {
    // Clear selection after deletion completes
    selectedObjects = [];
  }

  async function applyBulkStatus() {
    if (!bulkStatusValue || selectedObjects.length === 0) return;
    const { successes, errors } = await updateObjectsStatusBulk(
      selectedObjects,
      bulkStatusValue,
    );
    if (errors && errors.length) {
      console.error("Bulk status update had errors:", errors);
    }

    // Optimistically update local list so changes are visible without refresh
    if (successes && successes.length) {
      const updatedIds = new Set(successes.map((id) => String(id)));
      objects.items = objects.items.map((obj) =>
        updatedIds.has(String(obj.id))
          ? { ...obj, status: bulkStatusValue }
          : obj,
      );

      // If a status filter is active, ensure the view reflects it
      const currentFilter = (params.oStatus || "all").toLowerCase();
      if (currentFilter !== "all") {
        objects.items = objects.items.filter(
          (obj) => (obj.status || "").toLowerCase() === currentFilter,
        );
      }
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

  function openBulkEdit() {
    if (!selectedObjects?.length) return;
    const ids = selectedObjects.map(String).join(",");
    const returnTo = `/projects/${institution.project_id}/institutions/${institution.id}`;
    const url = `/projects/${institution.project_id}/objects/bulk-edit?ids=${encodeURIComponent(ids)}&returnTo=${encodeURIComponent(returnTo)}`;
    window.location.href = url;
  }

  function handleFiltersClick() {
    showAdvancedFilters = true;
  }
  function closeAdvancedFilters() {
    showAdvancedFilters = false;
  }
  function onFiltersChange() {
    advancedFilters = { ...advancedFilters };
    console.debug("Advanced filters changed (institution)", advancedFilters);
    void loadObjects();
  }

  async function loadObjects() {
    try {
      const opts = {
        projectId: institution.project_id,
        institutionIds: [institution.id],
        page: (params.oPage || 1) - 1,
        pageSize: params.pageSize || 25,
        orderBy: params.oOrderBy || "updated_at",
        direction: params.oDirection || "asc",
      };

      // Status filter
      if (params.oStatus && params.oStatus !== "all") {
        opts.status = params.oStatus;
      }

      // Research field filters
      const rfList = researchFields?.result || researchFields || [];
      const researchFieldFilters = [];
      rfList.forEach((f) => {
        const fType = String(f.type || "").toLowerCase();
        const sel = advancedFilters?.[f.id] || [];
        if (fType === "vocabulary" && sel.length) {
          researchFieldFilters.push({ fieldId: f.id, vocabularyIds: sel });
        } else if (fType !== "vocabulary") {
          const tf = (advancedFilters?.__textFilters || []).find(
            (x) => x.kind === "research" && String(x.fieldId) === String(f.id)
          );
          if (tf?.query && tf.query.trim()) {
            researchFieldFilters.push({ fieldId: f.id, query: tf.query });
          }
        }
      });
      if (researchFieldFilters.length) {
        opts.researchFieldFilters = researchFieldFilters;
      }

      // Ontology field queries
      const ontologyFieldQueries = (advancedFilters?.__textFilters || [])
        .filter((x) => x.kind === "ontology" && x.query && x.query.trim())
        .map((x) => ({ fieldId: x.fieldId, query: x.query }));

      // Map top search to a specific ontology field when selected
      if (params.oSearch && params.oSearch.trim()) {
        const sf = params.oSearchField;
        if (sf && sf !== "all") {
          ontologyFieldQueries.push({ fieldId: sf, query: params.oSearch });
        } else {
          // Use generic text search when "all" is selected
          opts.genericQuery = params.oSearch;
        }
      }
      if (ontologyFieldQueries.length) {
        opts.ontologyFieldQueries = ontologyFieldQueries;
      }

      const result = await searchObjects(opts);
      objectsData = {
        items: result.items || [],
        totalCount: result.totalCount || 0,
        facets: result.facets || { institutions: [], statuses: [], researchFields: [] },
      };
    } catch (e) {
      console.error("Failed to load institution objects via faceted search:", e);
      objectsData = { items: [], totalCount: 0, facets: { institutions: [], statuses: [], researchFields: [] } };
    }
  }

  // Reactive search for institution view
  $effect(() => {
    params.oSearch;
    params.oSearchField;
    params.oStatus;
    params.oOrderBy;
    params.oDirection;
    params.oPage;
    params.pageSize;
    advancedFilters;
    institution.id;
    institution.project_id;
    void loadObjects();
  });
</script>

<div class="w-100">
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
            {t("common.clear-selection", { fallback: "Clear selection" })}
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
              {t("common.delete", { fallback: "Delete" })}
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
        bind:value={params.oSearch}
        optionsList={ontologyFieldsList}
        bind:optionsValue={params.oSearchField}
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
      <div class="d-flex align-items-center text-truncate gap-2">
        <div class="col-auto fs-7">
          {t("common.select-fields", { fallback: "Select Fields" })}
        </div>
        <InstitutionObjectsFields
          {displayFields}
          {ontologyFields}
          {researchFields}
          projectId={institution.project_id}
        />
      </div>

      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.status", { fallback: "Status" })}
        </div>
        <BaseSelect items={statuses} bind:value={params.oStatus} size="sm"
        ></BaseSelect>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.view-as", { fallback: "View as" })}
        </div>
        <BaseSelect items={viewAsOptions} bind:value={viewAs} size="sm"
        ></BaseSelect>
      </div>
      <button type="button" class="btn btn-outline-primary btn-sm" onclick={handleFiltersClick}>
        <i class="bi bi-filter"></i>
        {t("common.filter", { fallback: "Filter" })}
      </button>
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{institution.project_id}/objects/add?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("common.add-object", { fallback: "Add Object" })}</a
      >
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{institution.project_id}/import?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("common.import-data", { fallback: "Import Data" })}</a
      >
    </div>
  </div>
  {#if objectsData.totalCount}
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        {objectsData.totalCount}
        {#if objectsData.totalCount > 1}
          {t("common.objects", { fallback: "objects" })}
        {:else}
          {t("common.object", { fallback: "object" })}
        {/if}
      </div>
      {#if hasAppliedFilters}
        <div class="d-flex align-items-center justify-content-end gap-2 flex-wrap">
          {#each filterBadges as b}
            <span class="badge rounded-pill text-bg-secondary d-flex align-items-center gap-1">
              <span class="text-truncate" style="max-width: 240px;">{b.text}</span>
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
        {#each objectsData.items as object (object.id)}
          <div class="col-4">
            <ObjectCard {object} {displayFields} />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <ObjectsTable
        items={objectsData.items}
        bind:orderBy={params.oOrderBy}
        bind:direction={params.oDirection}
        bind:selectedObjects
        {displayFields}
      ></ObjectsTable>
    {/if}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">
      {t("common.no-objects-found", { fallback: "No objects found." })}
    </div>
  {/if}

  {#if objectsData.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination
          bind:page={params.oPage}
          pageSize={params.pageSize}
          count={objectsData.totalCount}
          size="sm"
        />
      </div>
    </div>
  {/if}
</div>

<!-- Bulk Delete Confirmation Modal (Reusable Component) -->
<BulkDeleteObjectsModal
  bind:isOpen={showBulkDeleteModal}
  selectedIds={selectedObjects}
  on:deleted={handleDeleted}
/>

<!-- Bulk Change Institution Modal (Reusable Component) -->
  <BulkChangeInstitutionModal
    bind:isOpen={showBulkInstitutionModal}
    projectId={institution.project_id}
    onConfirm={handleConfirmInstitution}
  />

  {#if showAdvancedFilters}
    <ObjectAdvancedFilters
      researchFields={researchFields?.result || researchFields || []}
      ontologyFields={ontologyFields?.result || ontologyFields || []}
      institutions={[institution]}
      enableInstitutionFilter={false}
      {vocabularies}
      bind:advancedFilters
      facets={objectsData?.facets || {}}
      onClose={closeAdvancedFilters}
      onFiltersChange={onFiltersChange}
    />
  {/if}
