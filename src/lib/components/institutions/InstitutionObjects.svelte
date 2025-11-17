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
  import { afterNavigate } from "$app/navigation";
  import { resource } from "runed";
  import { updateObjectsStatusBulk, updateObjectsInstitutionBulk, searchObjects } from "$lib/stores/ObjectsUtils.js";

  let { institution, ontologyFields, researchFields, displayFields, params = $bindable() } = $props();

  const { t } = getTranslationStore();

  // State
  let viewAs = $state("grid");
  let selectedObjects = $state([]);
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);
  let bulkStatusValue = $state("");
  let showAdvancedFilters = $state(false);
  let advancedFilters = $state(params?.oFilters || {});

  afterNavigate(() => { advancedFilters = params?.oFilters || {}; });

  // Options
  const viewAsOptions = $derived([
    { value: "grid", label: t("common.grid-view", { fallback: "Grid" }) },
    { value: "table", label: t("common.table-view", { fallback: "Table" }) },
  ]);

  const ontologyFieldsList = $derived([
    { value: "all", label: t("common.all", { fallback: "All" }) },
    ...ontologyFields.result.map((f) => ({ value: f.id, label: f.name.content })),
  ]);

  const statuses = $derived([
    { value: "all", label: t("common.all", { fallback: "All" }) },
    { value: "in progress", label: t("common.in-progress", { fallback: "In progress" }) },
    { value: "completed", label: t("common.completed", { fallback: "Completed" }) },
  ]);

  // Helpers
  const getFieldList = (fields) => fields?.result || fields || [];
  const buildFieldMap = (fields) => new Map(
    getFieldList(fields).map((f) => [String(f.id), f.name?.content || f.name || String(f.id)])
  );

  // Lookup maps
  const vocabularies = $derived(
    getFieldList(researchFields)
      .filter((f) => (f.type || "").toLowerCase() === "vocabulary")
      .flatMap((f) => (f.vocabularies || []).map((v) => ({
        id: v.id,
        field_id: f.id,
        name: v.option?.content || v.option,
      })))
  );

  const researchFieldsById = $derived(buildFieldMap(researchFields));
  const ontologyFieldsById = $derived(buildFieldMap(ontologyFields));
  const vocabularyFieldIds = $derived(
    new Set(getFieldList(researchFields)
      .filter((f) => (f.type || "").toLowerCase() === "vocabulary")
      .map((f) => String(f.id)))
  );
  const vocabById = $derived(new Map(vocabularies.map((v) => [String(v.id), v.name])));

  // Resource with debouncing for object loading
  const objectsResource = resource(
    () => ({
      search: params.oSearch,
      searchField: params.oSearchField,
      status: params.oStatus,
      orderBy: params.oOrderBy,
      direction: params.oDirection,
      page: params.oPage,
      pageSize: params.pageSize,
      filters: advancedFilters,
      institutionId: institution.id,
      projectId: institution.project_id,
    }),
    async (deps) => {
      const opts = {
        projectId: deps.projectId,
        institutionIds: [deps.institutionId],
        page: (deps.page || 1) - 1,
        pageSize: deps.pageSize || 25,
        orderBy: deps.orderBy || "updated_at",
        direction: deps.direction || "asc",
      };

      if (deps.status && deps.status !== "all") opts.status = deps.status;

      const rfList = getFieldList(researchFields);
      const researchFieldFilters = rfList.flatMap((f) => {
        const fType = String(f.type || "").toLowerCase();
        const sel = deps.filters?.[f.id] || [];
        if (fType === "vocabulary" && sel.length) return [{ fieldId: f.id, vocabularyIds: sel }];
        if (fType !== "vocabulary") {
          const tf = (deps.filters?.__textFilters || []).find((x) => x.kind === "research" && String(x.fieldId) === String(f.id));
          if (tf?.query?.trim()) return [{ fieldId: f.id, query: tf.query }];
        }
        return [];
      });
      if (researchFieldFilters.length) opts.researchFieldFilters = researchFieldFilters;

      const ontologyFieldQueries = (deps.filters?.__textFilters || [])
        .filter((x) => x.kind === "ontology" && x.query?.trim())
        .map((x) => ({ fieldId: x.fieldId, query: x.query }));

      if (deps.search?.trim()) {
        const sf = deps.searchField;
        if (sf && sf !== "all") {
          ontologyFieldQueries.push({ fieldId: sf, query: deps.search });
        } else {
          opts.genericQuery = deps.search;
        }
      }
      if (ontologyFieldQueries.length) opts.ontologyFieldQueries = ontologyFieldQueries;

      const result = await searchObjects(opts);
      return {
        items: result.items || [],
        totalCount: result.totalCount || 0,
        facets: result.facets || {},
      };
    },
    { debounce: { enabled: true, wait: 300 } }
  );

  const objectsData = $derived(objectsResource.current ?? { items: [], totalCount: 0, facets: {} });

  // Filter detection & badges
  const hasAppliedFilters = $derived(
    (params.oStatus && params.oStatus !== "all") ||
    params.oSearch?.trim() ||
    Object.entries(advancedFilters || {}).some(
      ([k, v]) => k !== "__textFilters" && Array.isArray(v) && v.length
    ) ||
    (advancedFilters?.__textFilters || []).length > 0
  );

  const clearFilter = (updates) => {
    Object.assign(params, updates);
    params.oPage = 1;
  };

  const getFieldName = (id, isResearch) => 
    (isResearch ? researchFieldsById : ontologyFieldsById).get(String(id)) || String(id);

  const filterBadges = $derived.by(() => {
    const badges = [];

    if (params.oStatus && params.oStatus !== "all") {
      badges.push({
        text: `${t("common.status", { fallback: "Status" })}: ${statuses.find((s) => s.value === params.oStatus)?.label || params.oStatus}`,
        onClear: () => clearFilter({ oStatus: "all" }),
      });
    }

    if (params.oSearch?.trim()) {
      badges.push({
        text: `${ontologyFieldsList.find((o) => o.value === params.oSearchField)?.label || t("common.search", { fallback: "Search" })}: ${params.oSearch}`,
        onClear: () => clearFilter({ oSearch: "" }),
      });
    }

    Object.entries(advancedFilters || {})
      .filter(([k, v]) => k !== "__textFilters" && Array.isArray(v) && v.length && vocabularyFieldIds.has(String(k)))
      .forEach(([fieldId, ids]) => {
        ids.forEach((vocabId) => {
          badges.push({
            text: `${getFieldName(fieldId, true)}: ${vocabById.get(String(vocabId)) || String(vocabId)}`,
            onClear: () => {
              advancedFilters = { ...advancedFilters, [fieldId]: (advancedFilters[fieldId] || []).filter((id) => String(id) !== String(vocabId)) };
              params.oFilters = advancedFilters;
              params.oPage = 1;
            },
          });
        });
      });

    (advancedFilters?.__textFilters || []).forEach((tf) => {
      badges.push({
        text: `${getFieldName(tf.fieldId, tf.kind === "research")}: ${tf.query}`,
        onClear: () => {
          advancedFilters = { 
            ...advancedFilters, 
            __textFilters: (advancedFilters.__textFilters || []).filter(
              (x) => !(String(x.kind) === String(tf.kind) && String(x.fieldId) === String(tf.fieldId))
            ) 
          };
          params.oFilters = advancedFilters;
          params.oPage = 1;
        },
      });
    });

    return badges;
  });

  // Bulk actions
  const applyBulkStatus = async () => {
    if (!bulkStatusValue || !selectedObjects.length) return;
    const { errors } = await updateObjectsStatusBulk(selectedObjects, bulkStatusValue);
    if (errors?.length) console.error("Bulk status update errors:", errors);
    selectedObjects = [];
    bulkStatusValue = "";
  };

  const handleConfirmInstitution = async ({ institutionId }) => {
    if (!institutionId || !selectedObjects.length) {
      showBulkInstitutionModal = false;
      return;
    }
    const { errors } = await updateObjectsInstitutionBulk(selectedObjects, institutionId);
    if (errors?.length) console.error("Bulk institution update errors:", errors);
    selectedObjects = [];
    showBulkInstitutionModal = false;
  };

  const openBulkEdit = () => {
    if (!selectedObjects?.length) return;
    window.location.href = `/projects/${institution.project_id}/objects/bulk-edit?ids=${encodeURIComponent(selectedObjects.map(String).join(","))}&returnTo=${encodeURIComponent(`/projects/${institution.project_id}/institutions/${institution.id}`)}`;
  };
</script>

<div class="w-100">
  <div class="row align-items-center mb-3 position-relative overflow-hidden py-2">
    {#if selectedObjects.length}
      <div transition:fly={{ opacity: 1, y: -35 }} class="d-flex align-items-center px-3 gap-2 position-absolute top-0 start-0 end-0 bottom-0 z-1 bg-white border-bottom">
        <div class="fw-bold">{selectedObjects.length} {t("common.selected-objects", { fallback: "selected objects" })}</div>
        <button class="btn btn-secondary btn-sm d-flex align-items-center gap-2" onclick={() => (selectedObjects = [])}>
          <span>{t("common.clear-selection", { fallback: "Clear selection" })}</span>
          <i class="bi bi-x-circle"></i>
        </button>
        <button class="btn btn-secondary btn-sm d-flex align-items-center gap-2" onclick={() => (showBulkInstitutionModal = true)}>
          <span>{t("common.change-institution", { fallback: "Change institution" })}</span>
          <i class="bi bi-bank"></i>
        </button>
        <BulkActionsStatusSelect items={statuses.filter((s) => s.value !== "all")} bind:value={bulkStatusValue} onValueChange={applyBulkStatus} />
        <button class="btn btn-secondary btn-sm d-flex align-items-center gap-2" onclick={openBulkEdit}>
          <span>{t("common.edit-information", { fallback: "Edit information" })}</span>
          <i class="bi bi-pencil"></i>
        </button>
        <div class="ms-auto">
          <button class="btn btn-danger btn-sm d-flex align-items-center gap-2" onclick={() => (showBulkDeleteModal = true)}>
            <span>{t("common.delete", { fallback: "Delete" })}</span>
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
      <div class="d-flex align-items-center text-truncate gap-2">
        <div class="col-auto fs-7">{t("common.select-fields", { fallback: "Select Fields" })}</div>
        <InstitutionObjectsFields {displayFields} {ontologyFields} {researchFields} projectId={institution.project_id} />
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">{t("common.status", { fallback: "Status" })}</div>
        <BaseSelect items={statuses} bind:value={params.oStatus} size="sm" />
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">{t("common.view-as", { fallback: "View as" })}</div>
        <BaseSelect items={viewAsOptions} bind:value={viewAs} size="sm" />
      </div>
      <button type="button" class="btn btn-outline-primary btn-sm" onclick={() => (showAdvancedFilters = true)}>
        <i class="bi bi-filter"></i> {t("common.filter", { fallback: "Filter" })}
      </button>
      <a class="btn btn-primary btn-sm" href="/projects/{institution.project_id}/objects/add?institution_id={institution.id}">
        <i class="bi bi-plus-lg"></i> {t("common.add-object", { fallback: "Add Object" })}
      </a>
      <a class="btn btn-primary btn-sm" href="/projects/{institution.project_id}/import-data?institution_id={institution.id}">
        <i class="bi bi-plus-lg"></i> {t("common.import-data", { fallback: "Import Data" })}
      </a>
    </div>
  </div>

  {#if objectsData.totalCount}
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        {objectsData.totalCount} {objectsData.totalCount > 1 ? t("common.objects", { fallback: "objects" }) : t("common.object", { fallback: "object" })}
      </div>
      {#if hasAppliedFilters}
        <div class="d-flex align-items-center justify-content-end gap-2 flex-wrap">
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
    </div>

    {#if viewAs === "grid"}
      <div class="row">
        {#each objectsData.items as object (object.id)}
          <div class="col-4"><ObjectCard {object} {displayFields} /></div>
        {/each}
      </div>
    {:else}
      <ObjectsTable items={objectsData.items} bind:orderBy={params.oOrderBy} bind:direction={params.oDirection} bind:selectedObjects {displayFields} />
    {/if}

    {#if objectsData.totalCount > params.pageSize}
      <div class="row">
        <div class="col-auto">
          <BasePagination bind:page={params.oPage} pageSize={params.pageSize} count={objectsData.totalCount} size="sm" />
        </div>
      </div>
    {/if}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">{t("common.no-objects-found", { fallback: "No objects found." })}</div>
  {/if}
</div>

<BulkDeleteObjectsModal bind:isOpen={showBulkDeleteModal} selectedIds={selectedObjects} on:deleted={() => (selectedObjects = [])} />
<BulkChangeInstitutionModal bind:isOpen={showBulkInstitutionModal} projectId={institution.project_id} onConfirm={handleConfirmInstitution} />

{#if showAdvancedFilters}
  <ObjectAdvancedFilters
    researchFields={getFieldList(researchFields)}
    ontologyFields={getFieldList(ontologyFields)}
    institutions={[institution]}
    enableInstitutionFilter={false}
    {vocabularies}
    bind:advancedFilters
    facets={objectsData.facets}
    onClose={() => (showAdvancedFilters = false)}
    onFiltersChange={() => {
      advancedFilters = { ...advancedFilters };
      params.oFilters = advancedFilters;
      params.oPage = 1;
    }}
  />
{/if}
