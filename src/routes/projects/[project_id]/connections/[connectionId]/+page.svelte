<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { goto, invalidate, invalidateAll } from "$app/navigation";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
    import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { page } from "$app/stores";
    import { getAssetImageUrl } from "$lib/utils/media.js";
    import { addVocabulary, deleteVocabulary } from "$lib/stores/ResearchFieldsUtils.js";

    const { data } = $props();
    const { t } = getTranslationStore();
    
    // State
    let searchTerm = $state("");
    let currentPage = $state(1);
    let itemsPerPage = $state(24);
    let sortOrder = $state("name_asc");
    
    // Modal State
    let deleteModalOpen = $state(false);
    let itemToDelete = $state(null);

    // Helper for status text
    function getStatusText(field) {
        if (field.onwebsite === 1) {
            return t("common.published", { fallback: "Published" });
        }
        return t("common.not-published", { fallback: "Not published" });
    }

    // Derived values
    let vocabularies = $derived(data.researchField?.vocabularies || []);

    let filteredVocabularies = $derived.by(() => {
        let items = [...vocabularies];
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            items = items.filter(v => 
                v.option?.content?.toLowerCase().includes(lowerTerm)
            );
        }
        return items;
    });

    let sortedVocabularies = $derived.by(() => {
        let items = [...filteredVocabularies];
        items.sort((a, b) => {
            const nameA = a.option?.content?.toLowerCase() || "";
            const nameB = b.option?.content?.toLowerCase() || "";
            if (sortOrder === "name_asc") return nameA.localeCompare(nameB);
            if (sortOrder === "name_desc") return nameB.localeCompare(nameA);
            return 0;
        });
        return items;
    });

    let paginatedVocabularies = $derived.by(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedVocabularies.slice(start, start + itemsPerPage);
    });

    function goToDetail(vocabularyId) {
        goto(`/projects/${data.project.id}/connections/${data.researchField.id}/${vocabularyId}`);
    }

    function goBack() {
        goto(`/projects/${data.project.id}/connections`);
    }

    function handleEditField() {
         goto(`/projects/${data.project.id}/data-structure/research-fields/${data.researchField.id}`);
    }

    async function handleDuplicate(vocab) {
        if (!vocab) return;
        
        let languageId = null;
        if (data.languages) {
             const defaultLang = data.languages.find(l => l.is_default) || data.languages[0];
             languageId = defaultLang?.id;
        } else if (data.project?.languages) {
             const defaultLang = data.project.languages.find(l => l.is_default) || data.project.languages[0];
             languageId = defaultLang?.id;
        }

        if (!languageId) {
             console.error("Missing language ID for duplication. Available languages:", data.languages);
             return;
        }

        const newOption = `${vocab.option?.content || "Untitled"} - copy`;
        const description = vocab.description?.content || "";
        const mainAsset = vocab.mainAsset?.id || vocab.main_asset_id;

        const params = {
             languageId,
             option: newOption,
             description,
             mainAsset
        };

        try {
            const { error: err } = await addVocabulary(data.researchField.id, params);
            if (!err) {
                await invalidateAll();
            } else {
                 console.error("Failed to duplicate vocabulary", err);
            }
        } catch (e) {
            console.error("Failed to duplicate vocabulary", e);
        }
    }

    function openDeleteModal(vocab) {
        itemToDelete = vocab;
        deleteModalOpen = true;
    }

    async function confirmDelete() {
        if(!itemToDelete) return;
        
        try {
            const { error: err } = await deleteVocabulary(itemToDelete.id);
            
            if (!err) {
                await invalidateAll();
            } else {
                 console.error("Failed to delete vocabulary", err);
            }
        } catch (e) {
            console.error("Failed to delete vocabulary", e);
        }
        
        deleteModalOpen = false;
        itemToDelete = null;
    }

</script>

<div class="container-fluid h-100 bg-light d-flex flex-column">
    <!-- Header Section -->
    <div class="pt-3 pb-3 border-bottom mb-3">
        <div class="d-flex align-items-center gap-2 mb-2 text-muted">
            <button class="btn btn-link p-0 text-decoration-none text-muted d-flex align-items-center" onclick={goBack}>
                <i class="bi bi-arrow-left me-1"></i>
                {t("project.connection-types", { fallback: "Connection types" })}
            </button>
        </div>
        
        <div class="d-flex justify-content-between align-items-start">
            <div>
                <h2 class="m-0 mb-2">{data.researchField?.name?.content || t("common.untitled", {fallback: "Untitled"})}</h2>
                <div class="d-flex align-items-center gap-2 text-muted mb-2">
                    {#if data.researchField.onwebsite !== 1}
                        <i class="bi bi-eye-slash"></i>
                        <span>{t("common.not-published-on-website", { fallback: "Not published on the website" })}</span>
                    {:else}
                         <i class="bi bi-eye"></i>
                        <span>{t("common.published-on-website", { fallback: "Published on the website" })}</span>
                    {/if}
                </div>
                 <p class="text-muted" style="max-width: 800px;">
                    {data.researchField?.description?.content || ""}
                </p>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-light border" onclick={handleEditField}>
                    <i class="bi bi-pencil me-1"></i>
                    {t("common.edit-connection-type", { fallback: "Edit connection type" })}
                </button>
                <div class="dropdown">
                    <button class="btn btn-light border" aria-label="More options" data-bs-toggle="dropdown">
                        <i class="bi bi-three-dots-vertical"></i>
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                         <li><button class="dropdown-item">{t("common.import", {fallback: "Import"})}</button></li>
                         <li><button class="dropdown-item">{t("common.export", {fallback: "Export"})}</button></li>
                    </ul>
                </div>
            </div>
        </div>
    </div>

    <!-- Controls -->
    <div class="row pt-2 pb-3 align-items-center">
        <div class="col-md-6 col-lg-4">
             <div class="input-group">
                <span class="input-group-text bg-white border-end-0">
                    <i class="bi bi-search"></i>
                </span>
                <input 
                    type="text" 
                    class="form-control border-start-0" 
                    placeholder={t("common.search", { fallback: "Search" })}
                    bind:value={searchTerm}
                />
            </div>
        </div>
         <div class="col text-end">
            <button class="btn btn-secondary text-white">
                <i class="bi bi-plus-lg me-1"></i>
                {t("common.add-connection", { fallback: "Add connection" })}
            </button>
        </div>
    </div>

    <!-- Stats & Sort -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="text-muted">
            {filteredVocabularies.length} {t("common.connections", { fallback: "connections" })}
        </div>
        <div class="d-flex align-items-center gap-2">
            <select class="form-select form-select-sm" bind:value={sortOrder}>
                <option value="name_asc">{t("common.sort-by-name", { fallback: "Sort by name" })}</option>
                <option value="name_desc">{t("common.sort-by-name-desc", { fallback: "Sort by name (Z-A)" })}</option>
            </select>
        </div>
    </div>

    <!-- Grid -->
    <div class="row g-3">
        {#each paginatedVocabularies as vocabulary (vocabulary.id)}
            <div class="col-md-6 col-lg-4 col-xl-3">
                <button class="card h-100 shadow-sm cursor-pointer border-0 bg-white text-start w-100 p-0" onclick={() => goToDetail(vocabulary.id)} type="button">
                    <div class="card-body d-flex align-items-center p-3">
                        <div class="bg-light rounded-circle d-flex align-items-center justify-content-center me-3" style="width: 48px; height: 48px; flex-shrink: 0;">
                             {#if vocabulary.mainAsset}
                                <img src={getAssetImageUrl(vocabulary.mainAsset, 'sm')} alt="" class="rounded-circle" style="width: 100%; height: 100%; object-fit: cover;" />
                            {:else}
                                <i class="bi bi-image text-muted" style="font-size: 1.5rem;"></i>
                            {/if}
                        </div>
                        <div class="flex-grow-1 overflow-hidden">
                             <p class="card-title mb-0 text-truncate" title={vocabulary.option?.content}>
                                {vocabulary.option?.content || t("common.untitled", {fallback: "Untitled"})}
                             </p>
                        </div>
                         
                         <div role="presentation" onclick={(e) => e.stopPropagation()}>
                             <BaseDropdownMenu 
                                align="end" 
                                side="bottom"
                                sideOffset={4}
                                alignOffset={0}
                                contentProps={{ style: "right: 0; left: auto;" }} 
                                triggerClass="btn btn-link text-muted p-0"
                            >
                                {#snippet trigger()}
                                    <i class="bi bi-three-dots-vertical"></i>
                                {/snippet}
                                {#snippet children({ close })}
                                    <button class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2" onclick={() => { handleDuplicate(vocabulary); close(); }}>
                                        <i class="bi bi-files"></i>
                                        {t("common.duplicate", {fallback: "Duplicate"})}
                                    </button>
                                    <button class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2 text-danger" onclick={() => { openDeleteModal(vocabulary); close(); }}>
                                        <i class="bi bi-trash"></i>
                                        {t("common.delete", {fallback: "Delete"})}
                                    </button>
                                {/snippet}
                            </BaseDropdownMenu>
                         </div>
                    </div>
                </button>
            </div>
        {/each}
        {#if filteredVocabularies.length === 0}
             <div class="col-12 text-center text-muted py-5">
                {t("common.no-connections-found", { fallback: "No connections found." })}
            </div>
        {/if}
    </div>

    <!-- Pagination -->
    {#if filteredVocabularies.length > 0}
        <div class="mt-4 d-flex justify-content-between align-items-center border-top pt-3">
            <div class="d-flex align-items-center gap-2">
                 <span class="text-muted">{t("common.show", {fallback: "Show"})}</span>
                 <select class="form-select form-select-sm" bind:value={itemsPerPage} style="width: 80px;">
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={48}>48</option>
                 </select>
                 <span class="text-muted">{t("common.connections", {fallback: "connections"})}</span>
            </div>
             <BasePagination bind:page={currentPage} pageSize={itemsPerPage} count={filteredVocabularies.length} />
        </div>
    {/if}
    
    <div class="pb-5"></div>
</div>

{#snippet deleteTitle()}
    {t("common.delete-connection", { fallback: "Delete connection" })}
{/snippet}

{#snippet deleteDescription()}
    {t("common.delete-connection-confirmation", { fallback: "Are you sure you want to delete this connection? This action cannot be undone." })}
{/snippet}

{#snippet deleteFooter()}
    <BaseButton 
        class="btn btn-secondary" 
        onClick={() => deleteModalOpen = false}
        text={t("common.cancel", {fallback: "Cancel"})}
    />
    <BaseButton 
        class="btn btn-danger ms-2" 
        onClick={confirmDelete}
        text={t("common.delete", {fallback: "Delete"})}
    />
{/snippet}

<BaseAlertDialog 
    bind:open={deleteModalOpen} 
    title={deleteTitle}
    description={deleteDescription}
    footer={deleteFooter}
/>

<style>
    /* Add any specific overrides here if bootstrap utilities aren't enough */
    .btn-link {
        color: inherit;
    }
    .btn-link:hover {
        color: var(--bs-primary);
    }
    .cursor-pointer {
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
    }

</style>
