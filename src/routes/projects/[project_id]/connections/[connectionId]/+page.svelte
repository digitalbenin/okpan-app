<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { goto, invalidate, invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
    import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import EditConnectionTypeModal from "$lib/components/research_fields/EditConnectionTypeModal.svelte";
    import { getAssetImageUrl } from "$lib/utils/media.js";
    import { addVocabulary, deleteVocabulary, deleteResearchField, updateResearchField } from "$lib/stores/ResearchFieldsUtils.js";
    import { DEFAULT_FIELDS_CONFIG } from "$lib/constants/connectionTemplates.js";

    const { data } = $props();
    const { t } = getTranslationStore();

    // State
    let searchTerm = $state("");
    let currentPage = $state(1);
    let itemsPerPage = $state(24);
    let sortOrder = $state("name_asc");

    // Modal State
    let modals = $state({
        deleteVocab: { open: false, item: null },
        deleteType: { open: false, loading: false },
        edit: { open: false, loading: false, config: { ...DEFAULT_FIELDS_CONFIG }, info: {} }
    });
    let isExportingCsv = $state(false);

    // Derived values
    let vocabularies = $derived(data.researchField?.vocabularies || []);

    let filteredVocabularies = $derived(
        searchTerm
            ? vocabularies.filter(v => v.option?.content?.toLowerCase().includes(searchTerm.toLowerCase()))
            : vocabularies
    );

    let sortedVocabularies = $derived(
        [...filteredVocabularies].sort((a, b) => {
            const nameA = a.option?.content?.toLowerCase() || "";
            const nameB = b.option?.content?.toLowerCase() || "";
            return sortOrder === "name_desc" ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
        })
    );

    let paginatedVocabularies = $derived(
        sortedVocabularies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    );

    function goBack() {
        goto(`/projects/${data.project.id}/connections`);
    }

    function goToDetail(vocabularyId) {
        goto(`/projects/${data.project.id}/connections/${data.researchField.id}/${vocabularyId}`);
    }

    function handleEditField() {
        modals.edit.info = {
            name: data.researchField.name?.content || "",
            description: data.researchField.description?.content || "",
            onwebsite: data.researchField.onwebsite === 1
        };
        modals.edit.config = { ...(data.researchField.fields_config || DEFAULT_FIELDS_CONFIG) };
        modals.edit.open = true;
    }

    async function handleSaveEdit() {
        modals.edit.loading = true;
        try {
            const params = {
                type: data.researchField.type,
                name: modals.edit.info.name,
                description: modals.edit.info.description,
                onwebsite: modals.edit.info.onwebsite ? 1 : 0,
                fields_config: JSON.parse(JSON.stringify(modals.edit.config))
            };
            const result = await updateResearchField(data.researchField.id, params);
            if (result && !result.error) {
                await invalidateAll();
                modals.edit.open = false;
            }
        } finally {
            modals.edit.loading = false;
        }
    }

    async function handleDuplicate(vocab) {
        if (!vocab) return;
        const languages = data.languages || data.project?.languages;
        const languageId = (languages?.find(l => l.is_default) || languages?.[0])?.id;
        if (!languageId) return;

        const params = {
            languageId,
            option: `${vocab.option?.content || "Untitled"} - copy`,
            description: vocab.description?.content || "",
            mainAsset: vocab.mainAsset?.id || vocab.main_asset_id
        };

        const { error } = await addVocabulary(data.researchField.id, params);
        if (!error) await invalidateAll();
    }

    function openDeleteModal(vocab) {
        modals.deleteVocab.item = vocab;
        modals.deleteVocab.open = true;
    }

    async function confirmDelete() {
        if (!modals.deleteVocab.item) return;
        const { error } = await deleteVocabulary(modals.deleteVocab.item.id);
        if (!error) await invalidateAll();
        modals.deleteVocab.open = false;
        modals.deleteVocab.item = null;
    }

    async function confirmDeleteType() {
        if (!data?.researchField?.id) return;
        modals.deleteType.loading = true;
        try {
            const { error } = await deleteResearchField(data.researchField.id);
            if (!error) {
                await invalidateAll();
                modals.deleteType.open = false;
                goBack();
            }
        } finally {
            modals.deleteType.loading = false;
        }
    }

    async function handleExportCsv() {
        if (!window?.api?.exportConnectionTypeCsv || !data?.project?.id || !data?.researchField?.id) return;
        if (isExportingCsv) return;
        isExportingCsv = true;
        try {
            const result = await window.api.exportConnectionTypeCsv({
                projectId: data.project.id,
                connectionTypeId: data.researchField.id
            });
            if (result && !result.canceled) {
                addToast({
                    data: {
                        type: "success",
                        title: t("common.export", { fallback: "Export" }),
                        description: t("common.export-success", { fallback: "Connections exported successfully." })
                    }
                });
            }
        } catch (error) {
            console.error('Error exporting connection type CSV:', error);
            addToast({
                data: {
                    type: "danger",
                    title: t("common.export", { fallback: "Export" }),
                    description: error?.message || t("common.something-went-wrong", { fallback: "Something went wrong." })
                }
            });
        } finally {
            isExportingCsv = false;
        }
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
                <BaseDropdownMenu
                    align="end"
                    side="bottom"
                    sideOffset={4}
                    alignOffset={0}
                    contentProps={{ style: "right: 0; left: auto;" }}
                    triggerClass="btn btn-light border d-flex align-items-center"
                >
                    {#snippet trigger()}
                        <i class="bi bi-three-dots-vertical"></i>
                    {/snippet}
                    {#snippet children({ close })}
                        <button
                            type="button"
                            class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2"
                            disabled={isExportingCsv}
                            onclick={() => {
                                handleExportCsv();
                                close();
                            }}
                        >
                            {#if isExportingCsv}
                                <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
                            {:else}
                                <i class="bi bi-download"></i>
                            {/if}
                            {t("common.export", { fallback: "Export" })}
                        </button>
                        <button
                            type="button"
                            class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2 text-danger"
                            onclick={() => {
                                modals.deleteType.open = true;
                                close();
                            }}
                        >
                            <i class="bi bi-trash"></i>
                            {t("common.delete", { fallback: "Delete" })}
                        </button>
                    {/snippet}
                </BaseDropdownMenu>
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
            <a href={`/projects/${data.project.id}/connections/${data.researchField.id}/add`} class="btn btn-sm btn-secondary text-white">
                <i class="bi bi-plus-lg me-1"></i>
                {t("common.add-connection", { fallback: "Add connection" })}
            </a>
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
                <button type="button" class="card h-100 shadow-sm w-100 border-0 p-0 text-start" onclick={() => goToDetail(vocabulary.id)} style="cursor: pointer; background: white;">
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
                      <select class="form-select form-select-sm" bind:value={itemsPerPage} style="width: 80px;" onchange={() => (currentPage = 1)}>  
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

{#snippet dialogSnippets(titleKey, descKey, onConfirm, loading = false, onCancel)}
    {#snippet title()}{t(titleKey.title, { fallback: titleKey.fallback })}{/snippet}
    {#snippet description()}{t(descKey.title, { fallback: descKey.fallback })}{/snippet}
    {#snippet footer()}
        <BaseButton class="btn btn-secondary" disabled={loading} onClick={onCancel} text={t("common.cancel", {fallback: "Cancel"})} />
        <BaseButton class="btn btn-danger ms-2" loading={loading} onClick={onConfirm} text={t("common.delete", {fallback: "Delete"})} />
    {/snippet}
{/snippet}

{#snippet deleteVocabTitle()}
    {t("common.delete-connection", { fallback: "Delete connection" })}
{/snippet}

{#snippet deleteVocabDescription()}
    {t("common.delete-connection-confirmation", { fallback: "Are you sure you want to delete this connection? This action cannot be undone." })}
{/snippet}

{#snippet deleteVocabFooter()}
    <BaseButton class="btn btn-secondary" onClick={() => modals.deleteVocab.open = false} text={t("common.cancel", {fallback: "Cancel"})} />
    <BaseButton class="btn btn-danger ms-2" onClick={confirmDelete} text={t("common.delete", {fallback: "Delete"})} />
{/snippet}

<BaseAlertDialog
    bind:open={modals.deleteVocab.open}
    title={deleteVocabTitle}
    description={deleteVocabDescription}
    footer={deleteVocabFooter}
/>

{#snippet deleteTypeTitle()}
    {t("common.delete-connection-type", { fallback: "Delete connection type" })}
{/snippet}

{#snippet deleteTypeDescription()}
    {t("common.delete-connection-type-confirmation", { fallback: "Are you sure you want to delete this connection type? This action cannot be undone." })}
{/snippet}

{#snippet deleteTypeFooter()}
    <BaseButton class="btn btn-secondary" disabled={modals.deleteType.loading} onClick={() => modals.deleteType.open = false} text={t("common.cancel", {fallback: "Cancel"})} />
    <BaseButton class="btn btn-danger ms-2" loading={modals.deleteType.loading} onClick={confirmDeleteType} text={t("common.delete", {fallback: "Delete"})} />
{/snippet}

<BaseAlertDialog
    bind:open={modals.deleteType.open}
    title={deleteTypeTitle}
    description={deleteTypeDescription}
    footer={deleteTypeFooter}
/>

<EditConnectionTypeModal
    bind:open={modals.edit.open}
    bind:basicInfo={modals.edit.info}
    bind:config={modals.edit.config}
    isSaving={modals.edit.loading}
    onSave={handleSaveEdit}
    t={t}
/>

<style>
    /* Add any specific overrides here if bootstrap utilities aren't enough */
    .btn-link {
        color: inherit;
    }
    .btn-link:hover {
        color: var(--bs-primary);
    }
</style>