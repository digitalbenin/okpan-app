<script>
  import { resource } from "runed";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import {
    searchObjects,
    linkAssetToObject,
    getObjectById,
  } from "$lib/api/ObjectsApi.js";
  import { getAssetById } from "$lib/api/AssetsApi.js";
  import { getObjectImageUrl } from "$lib/utils/media.js";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  // Note: we'll derive primary identifier locally to avoid fallback text

  // Declare bindable prop inside $props() as required by Svelte runes
  // preselectExisting controls whether already-linked objects are preselected
  // pendingUnlinks: array of object IDs that are pending unlink (not yet saved)
  let {
    isOpen = $bindable(),
    projectId,
    assetId,
    onLinked,
    onUnlinked,
    preselectExisting = true,
    pendingUnlinks = [],
    linkedObjectIds = null,
  } = $props();

  const PAGE_SIZE = 25;
  const EMPTY_RESULTS = { items: [], totalCount: 0 };

  let searchQuery = $state("");
  let currentPage = $state(1);
  const normalizeId = (id) => (id == null ? "" : String(id));

  let selectedObjectIds = $state(new Set());
  let initiallySelectedIds = $state(new Set());
  let resultsContainer;

  const searchResource = resource(
    [() => isOpen, () => searchQuery, () => currentPage, () => projectId, () => assetId],
    async ([open, query, page, pid, aid]) => {
      if (!open || !pid) return EMPTY_RESULTS;

      const params = {
        projectId: pid,
        page: Math.max(page - 1, 0),
        pageSize: PAGE_SIZE,
      };

      if (aid) {
        params.assetId = String(aid);
      }

      const trimmed = query.trim?.() ?? "";
      if (trimmed) params.genericQuery = trimmed;

      const { items = [], totalCount = 0, error } = await searchObjects(params);
      if (error) {
        throw new Error(
          typeof error === "string" ? error : error?.message || "Failed to search objects",
        );
      }

      return { items, totalCount };
    },
    { initialValue: EMPTY_RESULTS, debounce: 250 },
  );

  const searchItems = $derived.by(() => {
    const items = searchResource.current?.items ?? [];
    const linkedSet = linkedObjectIds ? new Set(linkedObjectIds.map(normalizeId)) : null;
    if (!linkedSet || linkedSet.size === 0) return items;
    const linked = [];
    const others = [];
    for (const obj of items) {
      if (linkedSet.has(normalizeId(obj.id))) linked.push(obj);
      else others.push(obj);
    }
    return [...linked, ...others];
  });
  const totalCount = $derived(searchResource.current?.totalCount ?? 0);
  const totalPages = $derived(Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1));
  const showPagination = $derived(totalCount > PAGE_SIZE);
  const loadingInitial = $derived(searchResource.loading && searchItems.length === 0);
  const hasResults = $derived(searchItems.length > 0);
  const prevPage = $derived(currentPage > 1 ? currentPage - 1 : null);
  const nextPage = $derived(currentPage < totalPages ? currentPage + 1 : null);

  async function preselectAlreadyLinked() {
    if (!assetId) return;
    try {
      const override = Array.isArray(linkedObjectIds) ? linkedObjectIds.map(normalizeId) : null;
      if (override?.length) {
        const normalized = override;
        selectedObjectIds = new Set(normalized);
        initiallySelectedIds = new Set(normalized);
        return;
      }

      const res = await getAssetById(String(assetId));
      const asset = Array.isArray(res?.result) ? res.result[0] : res?.result;
      const linkedIds = asset?.objectsAssets?.map(oa => normalizeId(oa.object_id)).filter(Boolean) ?? [];
      const pendingSet = new Set((pendingUnlinks || []).map(normalizeId));
      const validIds = linkedIds.filter(id => !pendingSet.has(id));
      
      if (validIds.length) {
        selectedObjectIds = new Set(validIds);
        initiallySelectedIds = new Set(validIds);
      } else {
        selectedObjectIds = new Set();
        initiallySelectedIds = new Set();
      }
    } catch (error) {
      console.error("Failed to preselect linked objects:", error);
    }
  }

  const getObjectDisplayName = (obj) => {
    const name = obj?.name?.content?.trim() || (typeof obj?.name === "string" && obj.name.trim());
    return name || obj?.objectsOntologyFields?.find(f => f.primary)?.value || obj?.id;
  }

  // Resolve thumbnail src from the first media asset
  const getMediaThumbSrc = (obj) => getObjectImageUrl(obj, "sm", false);

  function toggleSelectObject(id) {
    const normalized = normalizeId(id);
    const next = new Set(selectedObjectIds);
    if (next.has(normalized)) next.delete(normalized);
    else next.add(normalized);
    selectedObjectIds = next;
  }

  async function confirmLinkSelectedObjects() {
    const deselected = [...initiallySelectedIds].filter(id => !selectedObjectIds.has(id));
    const newlySelected = [...selectedObjectIds].filter(id => !initiallySelectedIds.has(id));
    
    if (selectedObjectIds.size === 0 && deselected.length === 0) {
      selectedObjectIds = new Set();
      initiallySelectedIds = new Set();
      isOpen = false;
      return;
    }

    // Fetch full object data for newly selected objects (don't save yet)
    const linkedObjects = await Promise.all(
      newlySelected.map(async (id) => {
        try {
          const full = await getObjectById(String(id));
          return full?.result || null;
        } catch (error) {
          console.error("Error fetching object:", error);
          return null;
        }
      })
    ).then(results => results.filter(Boolean));

    if (linkedObjects.length) onLinked?.(linkedObjects);
    if (deselected.length) onUnlinked?.(deselected);

    selectedObjectIds = new Set();
    initiallySelectedIds = new Set();
    isOpen = false;
  }

  $effect(() => {
    if (isOpen) {
      preselectExisting ? preselectAlreadyLinked() : (selectedObjectIds = new Set(), initiallySelectedIds = new Set());
      currentPage = 1;
    }
  });

  let lastQueryValue = "";
  $effect(() => {
    if (searchQuery !== lastQueryValue) {
      lastQueryValue = searchQuery;
      currentPage = 1;
    }
  });

  $effect(() => {
    if (currentPage > totalPages) currentPage = totalPages;
  });

  $effect(() => {
    currentPage;
    resultsContainer?.scrollTo({ top: 0, behavior: "smooth" });
  });

  function goToPage(page) {
    const capped = Math.min(Math.max(page, 1), totalPages);
    if (capped !== currentPage) {
      currentPage = capped;
    }
  }
</script>

<BaseModal bind:isOpen size="lg">
  {#snippet header()}
    Select object to link
  {/snippet}

  {#snippet body()}
    <div
      class="d-flex flex-column gap-2"
      style="height: 60vh; overflow-y: auto;"
      bind:this={resultsContainer}
    >
      <!-- Search Bar -->
      <div class="d-flex align-items-center gap-2">
        <div class="input-group">
          <span class="input-group-text bg-white"
            ><i class="bi bi-search"></i></span
          >
          <input
            class="form-control"
            type="text"
            placeholder="Search objects"
            bind:value={searchQuery}
          />
        </div>
        <div class="d-flex align-items-center gap-2">
          <span class="text-muted small">{totalCount} objects found</span>
          {#if searchResource.loading}
            <div class="spinner-border spinner-border-sm text-secondary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
          {/if}
        </div>
      </div>

      {#if searchResource.error}
        <div class="alert alert-danger py-2" role="alert">
          {searchResource.error.message}
        </div>
      {/if}

      {#if loadingInitial}
        <div class="py-3 text-center text-muted">
          <div class="spinner-border text-secondary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      {:else if hasResults}
        {#each searchItems as obj}
          <div class="border rounded bg-light p-2 mb-2">
            <div class="d-flex align-items-start gap-2">
              <div class="flex-grow-1">
                <!-- Header: primary ID + add/remove button -->
                <div class="d-flex justify-content-between align-items-center">
                  <span class="fw-medium">{getObjectDisplayName(obj)}</span>
                  <div class="d-flex align-items-center gap-2">
                    <button
                      class={selectedObjectIds.has(obj.id)
                        ? "btn btn-sm btn-success"
                        : "btn btn-sm btn-outline-secondary"}
                      onclick={() => toggleSelectObject(obj.id)}
                    >
                      {#if selectedObjectIds.has(obj.id)}
                        <i class="bi bi-check"></i> Added
                      {:else}
                        <i class="bi bi-plus"></i> Add
                      {/if}
                    </button>
                  </div>
                </div>
                <div class="border-bottom mt-2 mb-2"></div>

                <!-- Research fields: first 4 -->
                {#if obj.objectsResearchFields && obj.objectsResearchFields.length > 0}
                  <div class="small text-muted mt-1">
                    {#each obj.objectsResearchFields.slice(0, 4) as rf}
                      <div
                        class="d-flex justify-content-start gap-2 align-items-center py-1 border-bottom border-light"
                      >
                        <span class="text-truncate" style="max-width: 60%;"
                          >{rf.researchField?.name?.content ||
                            "Research field"}</span
                        >
                        <span class="fw-medium text-end" style="max-width: 40%;"
                          >{rf.vocabulary?.option?.content || rf.value}</span
                        >
                      </div>
                    {/each}
                  </div>
                {:else}
                  <div class="small text-muted">No research fields</div>
                {/if}

                <!-- Media row below research fields -->
                <div class="mt-2 border-top py-2">
                  <div class="text-muted small mb-1">Media:</div>
                  {#if getMediaThumbSrc(obj)}
                    <BaseImage
                      src={getMediaThumbSrc(obj)}
                      alt="Media thumbnail"
                      style="width: 64px; height: 64px; border: 1px solid #eee;"
                      class="rounded"
                      objectFit="cover"
                      compact={true}
                    />
                  {:else}
                    <div class="small text-muted">No media</div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      {:else}
        <div class="py-3 text-center text-muted">No objects found</div>
      {/if}

      {#if showPagination}
        <div class="d-flex justify-content-between align-items-center my-2 me-4">
          <span class="small text-muted">Page {currentPage} of {totalPages}</span>
          <nav aria-label="Object search pagination">
            <ul class="pagination pagination-sm mb-0">
              <li class="page-item" class:disabled={!prevPage}>
                <button
                  class="page-link"
                  type="button"
                  onclick={() => prevPage && goToPage(prevPage)}
                  disabled={!prevPage}
                >
                  Prev
                </button>
              </li>

              {#if prevPage}
                <li class="page-item">
                  <button class="page-link" type="button" onclick={() => goToPage(prevPage)}>
                    {prevPage}
                  </button>
                </li>
              {/if}

              <li class="page-item active">
                <button class="page-link" type="button" disabled>{currentPage}</button>
              </li>

              {#if nextPage}
                <li class="page-item">
                  <button class="page-link" type="button" onclick={() => goToPage(nextPage)}>
                    {nextPage}
                  </button>
                </li>
              {/if}

              <li class="page-item" class:disabled={!nextPage}>
                <button
                  class="page-link"
                  type="button"
                  onclick={() => nextPage && goToPage(nextPage)}
                  disabled={!nextPage}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex justify-content-between align-items-center w-100">
      <div class="text-muted small">{selectedObjectIds.size} selected</div>
      <div class="d-flex gap-2">
        <BaseButton
          class="btn btn-secondary"
          text="Cancel"
          onClick={() => (isOpen = false)}
        />
        <BaseButton
          class="btn btn-primary"
          text="Confirm"
          onClick={confirmLinkSelectedObjects}
        />
      </div>
    </div>
  {/snippet}
</BaseModal>

<style>
  /* Keep styles minimal; parent modal provides most layout */
</style>
