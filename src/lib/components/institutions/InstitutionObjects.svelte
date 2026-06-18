<script>
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
  import ObjectCard from "$lib/components/overview/ObjectCard.svelte";
  import ObjectsTable from "$lib/components/objects/ObjectsTable.svelte";
  import InstitutionObjectsFields from "$lib/components/institutions/InstitutionObjectsFields.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconCirclePlus, IconChevronDown, IconTableImport, IconFilter, IconX, IconGridDots, IconListDetails } from "@tabler/icons-svelte";
  import BulkDeleteObjectsModal from "$lib/components/objects/BulkDeleteObjectsModal.svelte";
  import BulkChangeInstitutionModal from "$lib/components/objects/BulkChangeInstitutionModal.svelte";
  import BulkEditObjectsModal from "$lib/components/objects/BulkEditObjectsModal.svelte";
  import BulkActionsStatusSelect from "$lib/components/objects/BulkActionsStatusSelect.svelte";
  import ObjectAdvancedFilters from "$lib/components/objects/ObjectAdvancedFilters.svelte";
  import { topCurtainOverlay } from "$lib/utils/transitions.js";
  import { afterNavigate } from "$app/navigation";
  import { page } from "$app/stores";
  import { resource } from "runed";
  import { updateObjectsStatusBulk, updateObjectsInstitutionBulk, searchObjects } from "$lib/api/ObjectsApi.js";

  let { institution, ontologyFields, researchFields, displayFields, params = $bindable() } = $props();

  const { t } = getTranslationStore();

  // State
  let selectedObjects = $state([]);
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);
  let showBulkEditModal = $state(false);
  let bulkStatusValue = $state("");
  let showAdvancedFilters = $state(false);
  let advancedFilters = $state(params?.oFilters || {});

  afterNavigate(() => { advancedFilters = params?.oFilters || {}; });
  const listQuery = $derived($page.url.search || "");
  const viewAs = $derived(params?.oViewAs || "grid");

  // Helpers
  const getFieldList = (fields) => fields?.result || fields || [];
  const buildFieldMap = (fields) => new Map(
    getFieldList(fields).map((f) => [String(f.id), f.name?.content || f.name || String(f.id)])
  );

  const statuses = $derived([
    { value: "all", label: t("common.all-status") },
    { value: "in progress", label: t("common.in-progress") },
    { value: "completed", label: t("common.completed") },
  ]);

  const sortOptions = $derived([
    { value: "updated_at", label: t("common.sort-by-date") },
    { value: "created_at", label: t("common.sort-by-created") },
    { value: "name", label: t("common.sort-by-name") },
  ]);

  // Lookup maps
  const researchFieldsById = $derived(buildFieldMap(researchFields));
  const ontologyFieldsById = $derived(buildFieldMap(ontologyFields));
  
  const vocabularies = $derived(
    getFieldList(researchFields)
      .filter((f) => (f.type || "").toLowerCase() === "vocabulary")
      .flatMap((f) => (f.vocabularies || []).map((v) => ({
        id: v.id,
        field_id: f.id,
        name: v.option?.content || v.option,
        mainAsset: v.mainAsset || null,
      })))
  );

  const vocabularyFieldIds = $derived(
    new Set(getFieldList(researchFields)
      .filter((f) => (f.type || "").toLowerCase() === "vocabulary")
      .map((f) => String(f.id)))
  );
  
  const vocabById = $derived(new Map(vocabularies.map((v) => [String(v.id), v.name])));

  // Build search filters
  const buildSearchFilters = (deps) => {
    const opts = {
      projectId: deps.projectId,
      institutionIds: [deps.institutionId],
      page: (deps.page || 1) - 1,
      pageSize: deps.pageSize || 25,
      orderBy: deps.orderBy || "updated_at",
      direction: deps.direction || "asc",
    };

    if (deps.status && deps.status !== "all") opts.status = deps.status;

    // Research field filters
    const rfList = getFieldList(researchFields);
    const researchFieldFilters = rfList.flatMap((f) => {
      const fType = String(f.type || "").toLowerCase();
      const sel = deps.filters?.[f.id] || [];
      if (fType === "vocabulary" && sel.length) return [{ fieldId: f.id, vocabularyIds: sel }];
      const tf = (deps.filters?.__textFilters || []).find((x) => x.kind === "research" && String(x.fieldId) === String(f.id));
      return tf?.query?.trim() ? [{ fieldId: f.id, query: tf.query }] : [];
    });
    if (researchFieldFilters.length) opts.researchFieldFilters = researchFieldFilters;

    // Ontology field queries
    const ontologyFieldQueries = (deps.filters?.__textFilters || [])
      .filter((x) => x.kind === "ontology" && x.query?.trim())
      .map((x) => ({ fieldId: x.fieldId, query: x.query }));

    if (deps.search?.trim()) {
      opts.genericQuery = deps.search;
    }
    if (ontologyFieldQueries.length) opts.ontologyFieldQueries = ontologyFieldQueries;

    return opts;
  };

  // Resource with debouncing for object loading
  const objectsResource = resource(
    () => ({
      search: params.oSearch,
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
      const result = await searchObjects(buildSearchFilters(deps));
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
    Object.entries(advancedFilters || {}).some(([k, v]) => k !== "__textFilters" && Array.isArray(v) && v.length) ||
    (advancedFilters?.__textFilters || []).length > 0
  );

  const clearFilter = (updates) => {
    Object.assign(params, updates);
    params.oPage = 1;
  };

  const getFieldName = (id, isResearch) => 
    (isResearch ? researchFieldsById : ontologyFieldsById).get(String(id)) || String(id);

  const createFilterBadge = (text, onClear) => ({ text, onClear });

  const filterBadges = $derived.by(() => {
    const badges = [];

    // Status filter
    if (params.oStatus && params.oStatus !== "all") {
      const statusLabel = statuses.find((s) => s.value === params.oStatus)?.label || params.oStatus;
      badges.push(createFilterBadge(
        `${t("common.status")}: ${statusLabel}`,
        () => clearFilter({ oStatus: "all" })
      ));
    }

    // Search filter
    if (params.oSearch?.trim()) {
      badges.push(createFilterBadge(
        `${t("common.search")}: ${params.oSearch}`,
        () => clearFilter({ oSearch: "" })
      ));
    }

    // Vocabulary filters
    Object.entries(advancedFilters || {})
      .filter(([k, v]) => k !== "__textFilters" && Array.isArray(v) && v.length && vocabularyFieldIds.has(String(k)))
      .forEach(([fieldId, ids]) => {
        ids.forEach((vocabId) => {
          badges.push(createFilterBadge(
            `${getFieldName(fieldId, true)}: ${vocabById.get(String(vocabId)) || String(vocabId)}`,
            () => {
              advancedFilters = { ...advancedFilters, [fieldId]: (advancedFilters[fieldId] || []).filter((id) => String(id) !== String(vocabId)) };
              params.oFilters = advancedFilters;
              params.oPage = 1;
            }
          ));
        });
      });

    // Text filters
    (advancedFilters?.__textFilters || []).forEach((tf) => {
      badges.push(createFilterBadge(
        `${getFieldName(tf.fieldId, tf.kind === "research")}: ${tf.query}`,
        () => {
          advancedFilters = { 
            ...advancedFilters, 
            __textFilters: (advancedFilters.__textFilters || []).filter(
              (x) => !(String(x.kind) === String(tf.kind) && String(x.fieldId) === String(tf.fieldId))
            ) 
          };
          params.oFilters = advancedFilters;
          params.oPage = 1;
        }
      ));
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
    showBulkEditModal = true;
  };
</script>

{#snippet actionButton(icon, text, onClick, variant = "secondary")}
  <button class="btn btn-{variant} btn-sm d-flex align-items-center gap-2" onclick={onClick}>
    <span>{text}</span>
    <i class="bi bi-{icon}"></i>
  </button>
{/snippet}

{#snippet toolbarButton(text, onClick, Icon)}
  <a class="btn btn-primary btn-sm d-flex align-items-center gap-1" href={onClick}>
    <Icon size={16} />
    {text}
  </a>
{/snippet}

<div class="w-100">
<BaseSearchBar bind:search={params.oSearch} placeholder={t("common.search")} border="border-gray-700">
  {#snippet children()}
  {@render toolbarButton(t("menu.import-data"), `/projects/${institution.project_id}/import-data?institution_id=${institution.id}`, IconTableImport)}  
  {@render toolbarButton(t("menu.add-object"), `/projects/${institution.project_id}/objects/add?institution_id=${institution.id}`, IconCirclePlus)}
  {/snippet}
  {#snippet toolbar()}
    <div class="col-auto">
      {objectsData.totalCount}
      {objectsData.totalCount === 1 ? t("common.object") : t("common.objects")}
    </div>
    <div class="d-flex justify-content-end gap-2 flex-wrap">
      <BaseSelect items={statuses} bind:value={params.oStatus} as="button" inputClass="border-secondary btn-transparent btn-sm border">
        <IconChevronDown size={16} />
      </BaseSelect>
      <BaseSelect items={sortOptions} bind:value={params.oOrderBy} as="button" inputClass="border-secondary btn-transparent btn-sm border">
        <IconChevronDown size={16} />
      </BaseSelect>
      <InstitutionObjectsFields
        {displayFields}
        {ontologyFields}
        {researchFields}
        projectId={institution.project_id}
        as="button"
        inputClass="border-secondary btn-transparent btn-sm border"
      />
      <button type="button" class="btn btn-transparent btn-sm border border-secondary" onclick={() => (showAdvancedFilters = true)}>
        <IconFilter size={16} />
         {t("common.filters")}
      </button>
      <div class="btn-group btn-group-sm" role="group" aria-label={t("common.view-as")}>
        {#each [{ val: "grid", icon: IconGridDots, label: t("common.grid-view") }, { val: "table", icon: IconListDetails, label: t("common.table-view") }] as view}
          <button
            type="button"
            class="btn btn-transparent border border-secondary"
            class:active={viewAs === view.val}
            class:btn-dark={viewAs === view.val}
            onclick={() => (params.oViewAs = view.val)}
            aria-label={view.label}
          >
            <view.icon size={16} />
          </button>
        {/each}
      </div>
    </div>
    {#if selectedObjects.length}
      <div
        transition:topCurtainOverlay={{ y: -20, duration: 220 }}
        class="position-absolute top-0 start-0 end-0 bottom-0 z-2 bg-white"
      >
        <div class="row align-items-center g-2 pb-2  h-100">
          <div class="col d-flex align-items-center gap-2 flex-wrap">
            {@render actionButton("x-circle", t("common.clear-selection"), () => (selectedObjects = []))}
            {@render actionButton("bank", t("common.change-institution"), () => (showBulkInstitutionModal = true))}
            <BulkActionsStatusSelect
              items={statuses.filter((s) => s.value !== "all")}
              bind:value={bulkStatusValue}
              onValueChange={applyBulkStatus}
            />
            {@render actionButton("pencil", t("common.edit-object-info"), openBulkEdit)}
            {@render actionButton("trash", t("common.delete"), () => (showBulkDeleteModal = true), "danger")}
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
          class="btn btn-outline-dark btn-sm d-flex align-items-center gap-1 rounded-2"
          aria-label={t("common.remove")}
          onclick={onClear}
        >
          <span class="text-truncate" style="max-width: 240px;">{text}</span>
          <IconX size={16} />
        </button>
      {/each}
    </div>
  {/if}

  {#if objectsData.totalCount}
    {#key displayFields}
      {#if viewAs === "grid"}
        <div class="row g-3">
          {#each objectsData.items as object (object.id)}
            <div class="col-3"><ObjectCard {object} {displayFields} bind:selected={selectedObjects} listQuery={listQuery} /></div>
          {/each}
        </div>
      {:else}
        <ObjectsTable items={objectsData.items} bind:orderBy={params.oOrderBy} bind:direction={params.oDirection} bind:selectedObjects {displayFields} listQuery={listQuery} />
      {/if}
    {/key}

    {#if objectsData.totalCount > params.pageSize}
      <div class="row">
        <div class="col-auto">
          <BasePagination bind:page={params.oPage} pageSize={params.pageSize} count={objectsData.totalCount} size="sm" />
        </div>
      </div>
    {/if}
  {:else}
    <div class="text-center fst-italic text-muted mt-5">{t("common.no-objects-found")}</div>
  {/if}
</div>

<BulkDeleteObjectsModal bind:isOpen={showBulkDeleteModal} selectedIds={selectedObjects} on:deleted={() => (selectedObjects = [])} />
<BulkChangeInstitutionModal bind:isOpen={showBulkInstitutionModal} projectId={institution.project_id} selectedCount={selectedObjects.length} onConfirm={handleConfirmInstitution} />
<BulkEditObjectsModal bind:isOpen={showBulkEditModal} projectId={institution.project_id} selectedIds={selectedObjects} researchFields={researchFields} onSaved={() => (selectedObjects = [])} />

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
