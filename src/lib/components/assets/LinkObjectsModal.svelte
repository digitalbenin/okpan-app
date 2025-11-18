<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getSearch } from "$lib/stores/SearchUtils.js";
  import { linkAssetToObject, getObjectById } from "$lib/stores/ObjectsUtils.js";
  import { getAssetById } from "$lib/stores/AssetsUtils.js";
  import { getObjectImageUrl } from "$lib/utils/media.js";
  // Note: we'll derive primary identifier locally to avoid fallback text

  // Declare bindable prop inside $props() as required by Svelte runes
  // preselectExisting controls whether already-linked objects are preselected
  let {
    isOpen = $bindable(),
    projectId,
    assetId,
    onLinked,
    preselectExisting = true,
  } = $props();

  let searchQuery = $state("");
  let isSearching = $state(false);
  let searchResults = $state([]);
  let totalSearchCount = $state(0);
  let selectedObjectIds = $state(new Set());

  // Preselect objects already linked to this asset
  async function preselectAlreadyLinked() {
    try {
      if (!assetId) return;
      const res = await getAssetById(String(assetId));
      const asset = Array.isArray(res?.result) ? res.result[0] : res?.result;
      const linkedIds = (asset?.objectsAssets || [])
        .map((oa) => oa.object_id)
        .filter(Boolean);
      if (linkedIds.length > 0) {
        const next = new Set(selectedObjectIds);
        for (const id of linkedIds) next.add(id);
        selectedObjectIds = next;
      }
    } catch (e) {
      console.error("Failed to preselect linked objects:", e);
    }
  }

  async function loadSearchResults() {
    isSearching = true;
    try {
      const { items, totalCount } = await getSearch({
        query: searchQuery,
        projectId,
        // Ensure we only get objects, not institutions or assets
        entityTypes: ["objects"],
        pageSize: 25,
      });

      const enriched = [];
      for (const item of items || []) {
        // Skip any non-object types defensively
        if (item?.type && item.type !== "object") continue;
        if (item?.objectsResearchFields?.length) {
          enriched.push(item);
        } else if (item?.id) {
          const full = await getObjectById(item.id);
          if (!full.error && full.result) {
            enriched.push({
              ...item,
              objectsResearchFields: full.result.objectsResearchFields || [],
              objectsOntologyFields: full.result.objectsOntologyFields || [],
              objectsAssets: full.result.objectsAssets || [],
            });
          } else {
            enriched.push(item);
          }
        } else {
          enriched.push(item);
        }
      }

      searchResults = enriched;
      totalSearchCount = totalCount || (enriched?.length ?? 0);
    } catch (e) {
      console.error("Error loading search results:", e);
      searchResults = [];
      totalSearchCount = 0;
    } finally {
      isSearching = false;
    }
  }

  // Prefer the actual primary ontology field value; do not show fallback text
  function getPrimaryIdentifier(obj) {
    const field = obj?.objectsOntologyFields?.find((f) => f.primary);
    return field?.value ?? null;
  }

  // Display label: prefer object's name, then primary identifier, then numeric id
  function getObjectDisplayName(obj) {
    const name =
      (obj?.name?.content && String(obj.name.content).trim()) ||
      (typeof obj?.name === "string" && String(obj.name).trim());
    return name || getPrimaryIdentifier(obj) || obj?.id;
  }

  // Resolve thumbnail src from the first media asset
  const getMediaThumbSrc = (obj) => getObjectImageUrl(obj, 'sm');

  function toggleSelectObject(id) {
    const next = new Set(selectedObjectIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedObjectIds = next;
  }

  async function confirmLinkSelectedObjects() {
    if (!assetId || selectedObjectIds.size === 0) {
      isOpen = false;
      return;
    }

    const linkedObjects = [];
    for (const objectId of selectedObjectIds) {
      try {
        const res = await linkAssetToObject(String(objectId), String(assetId));
        if (res?.error) {
          console.error("Failed to link asset to object:", res.error);
          continue;
        }
        const full = await getObjectById(String(objectId));
        if (!full.error && full.result) {
          linkedObjects.push(full.result);
        }
      } catch (err) {
        console.error("Error linking object:", err);
      }
    }

    // Notify parent with full object results
    try {
      onLinked?.(linkedObjects);
    } catch (e) {
      console.error("onLinked callback error:", e);
    }

    // Reset and close
    selectedObjectIds = new Set();
    isOpen = false;
  }

  // Load results when modal opens
  $effect(() => {
    if (isOpen) {
      if (preselectExisting) {
        preselectAlreadyLinked();
      } else {
        // Ensure no preselection carried over
        selectedObjectIds = new Set();
      }
      loadSearchResults();
    }
  });
</script>

<BaseModal bind:isOpen size="lg">
  {#snippet header()}
    Select object to link
  {/snippet}

  {#snippet body()}
    <div
      class="d-flex flex-column gap-2"
      style="height: 60vh; overflow-y: auto;"
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
            oninput={loadSearchResults}
          />
        </div>
        <span class="text-muted small">{totalSearchCount} objects found</span>
      </div>

      {#if isSearching}
        <div class="py-3 text-center text-muted">Loading…</div>
      {:else if searchResults && searchResults.length > 0}
        {#each searchResults as obj}
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
                    <img
                      src={getMediaThumbSrc(obj)}
                      alt="Media thumbnail"
                      style="width: 64px; height: 64px; object-fit: cover; border-radius: 0.25rem; border: 1px solid #eee;"
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
