<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getSearch } from "$lib/api/SearchApi.js";
  import { throttle } from "$lib/utils/throttle.js";
  import { onMount } from "svelte";
  

  let {
    isOpen = $bindable(false),
    projectId,
    selectedCount = 0,
    pageSize = 10,
    onConfirm = () => {},
  } = $props();

  const { t } = getTranslationStore();

  let searchQuery = $state("");
  let isLoading = $state(false);
  let institutions = $state([]);
  let totalCount = $state(0);
  let page = $state(1);
  let selectedInstitutionId = $state(null);

  // Allow search only when modal is open and a projectId exists
  const canSearch = $derived.by(() => Boolean(isOpen) && Boolean(projectId));

  async function loadInstitutions() {
    isLoading = true;
    try {
      const { items, totalCount: tc, error } = await getSearch({
        query: searchQuery || "",
        projectId,
        entityTypes: ["institutions"],
        limit: 500, // fetch a large set, paginate client-side
      });
      if (error) {
        console.error("Institution search error:", error);
        institutions = [];
        totalCount = 0;
      } else {
        institutions = items || [];
        institutions.sort((a, b) => (a.name || a.title || "").localeCompare(b.name || b.title || ""));
        totalCount = typeof tc === "number" ? tc : (items?.length || 0);
        page = 1; // reset to first page on new search
      }
    } catch (e) {
      console.error("Failed to load institutions:", e);
      institutions = [];
      totalCount = 0;
    } finally {
      isLoading = false;
    }
  }

  // Initial load so institutions are available when the modal opens
  onMount(async () => {
    if (projectId) {
      await loadInstitutions();
    }
  });

  function close() {
    isOpen = false;
  }

  function confirmSelection() {
    if (!selectedInstitutionId) {
      close();
      return;
    }
    // Call parent-provided callback with selected institution id
    onConfirm({ institutionId: selectedInstitutionId });
    close();
  }

  // Pagination helpers (client-side)
  function pagedItems() {
    const start = (page - 1) * pageSize;
    return institutions.slice(start, start + pageSize);
  }

  const throttledSearch = throttle(async (val) => {
    searchQuery = val ?? "";
    if (!canSearch) return;
    await loadInstitutions();
  }, 300);
</script>

<BaseModal bind:isOpen={isOpen} size="lg">
  {#snippet header()}
    <div>
      {t("common.change-institution", { fallback: "Change Institution" })}
    </div>
  {/snippet}

  {#snippet body()}
    <div class="d-flex flex-column gap-3">
      <div class="text-dark fs-6">
        <span class="fw-semibold">{t("common.bulk-change-institution-hint-count", { count: selectedCount }, { fallback: `${selectedCount} objects selected` })}</span>
        <span>{t("common.bulk-change-institution-hint-action", { count: selectedCount }, { fallback: `— select the institution to move them to.` })}</span>
      </div>

      <div class="d-flex gap-2 align-items-center w-100">
        <BaseSearchBar bind:search={searchQuery} placeholder={t("common.search", { fallback: "Search" })} oninput={(e) => throttledSearch(e.target.value)} width="100%" border="border-secondary-subtle"/>
      </div>

      {#if isLoading}
        <div class="text-muted small">{t("common.loading", { fallback: "Loading..." })}</div>
      {:else}
        <div class="list-group">
          {#each pagedItems() as inst}
            <label class="list-group-item d-flex border-secondary-subtle align-items-center gap-2" class:bg-primary-subtle={inst.id === selectedInstitutionId}>
              <input
                type="radio"
                name="institution-select"
                value={inst.id}
                bind:group={selectedInstitutionId}
                class="form-check-input"
                style="accent-color: var(--bs-primary)"
              />
              <span class="fw-medium">{inst.name || inst.title || inst.id}</span>
            </label>
          {/each}
          {#if pagedItems().length === 0}
            <div class="text-muted small py-2">{t("common.no-results", { fallback: "No results" })}</div>
          {/if}
        </div>

        {#if totalCount > pageSize}
          <div class="d-flex justify-content-end mt-2">
            <BasePagination bind:page pageSize={pageSize} count={totalCount} size="sm" />
          </div>
        {/if}
      {/if}
    </div>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex gap-2">
      <BaseButton
        class="btn btn-secondary"
        text={t("common.cancel", { fallback: "Cancel" })}
        onClick={close}
      />
      <BaseButton
        class="btn btn-primary"
        text={t("common.confirm", { fallback: "Confirm" })}
        onClick={confirmSelection}
        disabled={!selectedInstitutionId}
      />
    </div>
  {/snippet}
</BaseModal>