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
  import { afterNavigate, goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { resource } from "runed";
  import { updateObjectsStatusBulk, updateObjectsInstitutionBulk, searchObjects } from "$lib/stores/ObjectsUtils.js";

  let { institution, ontologyFields, researchFields, displayFields, params = $bindable() } = $props();

  const { t } = getTranslationStore();

  // State
  let selectedObjects = $state([]);
  let showBulkDeleteModal = $state(false);
  let showBulkInstitutionModal = $state(false);
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

  // Options
  const ontologyFieldsList = $derived([
    { value: "all", label: t("common.all", { fallback: "All" }) },
    ...ontologyFields.result.map((f) => ({ value: f.id, label: f.name.content })),
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
      const sf = deps.searchField;
      (sf && sf !== "all") 
        ? ontologyFieldQueries.push({ fieldId: sf, query: deps.search })
        : opts.genericQuery = deps.search;
    }
    if (ontologyFieldQueries.length) opts.ontologyFieldQueries = ontologyFieldQueries;

    return opts;
  };

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
        `${t("common.status", { fallback: "Status" })}: ${statusLabel}`,
        () => clearFilter({ oStatus: "all" })
      ));
    }

    // Search filter
    if (params.oSearch?.trim()) {
      const searchLabel = ontologyFieldsList.find((o) => o.value === params.oSearchField)?.label || t("common.search", { fallback: "Search" });
      badges.push(createFilterBadge(
        `${searchLabel}: ${params.oSearch}`,
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
    const returnTo = `/projects/${institution.project_id}/institutions/${institution.id}`;
    const ids = selectedObjects.map(String).join(",");
    goto(`/projects/${institution.project_id}/objects/bulk-edit?ids=${encodeURIComponent(ids)}&returnTo=${encodeURIComponent(returnTo)}`);
  };
</script>

{#snippet actionButton(icon, text, onClick, variant = "secondary")}
  <button class="btn btn-{variant} btn-sm d-flex align-items-center gap-2" onclick={onClick}>
    <span>{text}</span>
    <i class="bi bi-{icon}"></i>
  </button>
{/snippet}

{#snippet toolbarButton(icon, text, onClick)}
  <a class="btn btn-secondary btn-sm" href={onClick}>
    <i class="bi bi-{icon}"></i>
    {text}
  </a>
{/snippet}

<div class="w-100">
  <div class="position-relative mb-3">
    {#if selectedObjects.length}
      <div class="d-flex align-items-center px-3 gap-2 py-2 bg-white border rounded-3">
        {@render actionButton("x-circle", t("common.clear-selection", { fallback: "Clear selection" }), () => (selectedObjects = []))}
        {@render actionButton("bank", t("common.change-institution", { fallback: "Change institution" }), () => (showBulkInstitutionModal = true))}
        <BulkActionsStatusSelect
          items={statuses.filter((s) => s.value !== "all")}
          bind:value={bulkStatusValue}
          onValueChange={applyBulkStatus}
        />
        {@render actionButton("pencil", t("common.edit-information", { fallback: "Edit information" }), openBulkEdit)}
        <div class="ms-auto">
          {@render actionButton("trash", t("common.delete", { fallback: "Delete" }), () => (showBulkDeleteModal = true), "danger")}
        </div>
      </div>
    {:else}
      <div class="row align-items-center g-2 py-2">
        <div class="col-12 col-md-6">
          <BaseInput
            icon="search"
            placeholder={t("common.search", { fallback: "Search" })}
            size="sm"
            bind:value={params.oSearch}
            optionsList={ontologyFieldsList}
            bind:optionsValue={params.oSearchField}
          />
        </div>
        <div class="col-12 col-md-6 d-flex justify-content-md-end gap-2">
          {@render toolbarButton("plus-lg", t("common.add-object", { fallback: "Add Object" }), `/projects/${institution.project_id}/objects/add?institution_id=${institution.id}`)}
          {@render toolbarButton("plus-lg", t("common.import-data", { fallback: "Import Data" }), `/projects/${institution.project_id}/import-data?institution_id=${institution.id}`)}
        </div>
      </div>

      <div class="row align-items-center g-2 pb-2 mt-2">
        <div class="col-auto">
          {objectsData.totalCount}
          {objectsData.totalCount === 1 ? t("common.object", { fallback: "object" }) : t("common.objects", { fallback: "objects" })}
        </div>
        <div class="col d-flex justify-content-end gap-2 flex-wrap">
          <BaseSelect items={statuses} bind:value={params.oStatus} as="button" inputClass="btn-light btn-sm border">
            <i class="bi bi-chevron-down"></i>
          </BaseSelect>
          <BaseSelect items={sortOptions} bind:value={params.oOrderBy} as="button" inputClass="btn-light btn-sm border">
            <i class="bi bi-chevron-down"></i>
          </BaseSelect>
          <InstitutionObjectsFields
            {displayFields}
            {ontologyFields}
            {researchFields}
            projectId={institution.project_id}
            as="button"
            inputClass="btn-light btn-sm border"
          />
          <button type="button" class="btn btn-light btn-sm border" onclick={() => (showAdvancedFilters = true)}>
            <i class="bi bi-filter"></i>
            {t("common.filter", { fallback: "Filter" })}
          </button>
          <div class="btn-group btn-group-sm" role="group" aria-label={t("common.view-as", { fallback: "View as" })}>
            {#each [{ val: "grid", icon: "grid-3x3-gap", label: t("common.grid-view", { fallback: "Grid" }) }, { val: "table", icon: "list", label: t("common.table-view", { fallback: "Table" }) }] as view}
              <button
                type="button"
                class="btn btn-light border"
                class:active={viewAs === view.val}
                onclick={() => (params.oViewAs = view.val)}
                aria-label={view.label}
              >
                <i class="bi bi-{view.icon}"></i>
              </button>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>

  {#if hasAppliedFilters}
    <div class="d-flex align-items-center gap-2 flex-wrap mb-3">
      {#each filterBadges as { text, onClear }}
        <span class="badge rounded-pill text-bg-secondary d-flex align-items-center gap-1">
          <span class="text-truncate" style="max-width: 240px;">{text}</span>
          <button class="btn btn-sm btn-link text-white p-0 m-0" aria-label={t("common.remove", { fallback: "Remove" })} onclick={onClear}>
            <i class="bi bi-x-lg"></i>
          </button>
        </span>
      {/each}
    </div>
  {/if}

  {#if objectsData.totalCount}
    {#key displayFields}
      {#if viewAs === "grid"}
        <div class="row">
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
