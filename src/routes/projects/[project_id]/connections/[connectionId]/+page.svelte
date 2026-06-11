<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { goto, invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
    import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
    import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
    import ConnectionVocabularyChip from "$lib/components/research_fields/ConnectionVocabularyChip.svelte";
    import { getTemplateColorClasses } from "$lib/constants/connectionTemplates.js";
    import { addVocabulary, deleteVocabulary, deleteResearchField } from "$lib/api/ResearchFieldsApi.js";
    import {
        IconChartCircles,
        IconPencil,
        IconEye,
        IconEyeOff,
        IconPlus,
        IconDotsVertical,
        IconDownload,
        IconTrash,
    } from "@tabler/icons-svelte";

    const { data } = $props();
    const { t } = getTranslationStore();

    let searchTerm = $state("");
    let currentPage = $state(1);
    let itemsPerPage = $state(24);
    let sortOrder = $state("name_asc");

    let modals = $state({
        deleteVocab: { open: false, item: null },
        deleteType: { open: false, loading: false }
    });
    let isExportingCsv = $state(false);

    let vocabularies = $derived(data.researchField?.vocabularies || []);
    let templateId = $derived(data.researchField?.fields_config?.templateId || null);
    let colorClasses = $derived(getTemplateColorClasses(templateId));
    let connectionTypeName = $derived(data.researchField?.name?.content || t("common.untitled", {fallback: "Untitled"}));
    let connectionDescription = $derived(data.researchField?.description?.content || "");
    let isPublished = $derived(data.researchField?.onwebsite === 1);
    let searchPlaceholder = $derived(t("common.search", { fallback: "Search" }));

    let breadcrumbItems = $derived([
        { label: t("project.connection-types", { fallback: "Connection types" }), href: `/projects/${data.project.id}/connections` },
        { label: connectionTypeName }
    ]);

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

{#if !data.missingEntity && data.researchField}
<div class="h-100 d-flex flex-column mx-n4 mt-n4">
    <!-- Header: full-width white band with bottom border -->
    <div class="bg-white border-bottom p-4">
        <div class="d-flex justify-content-between align-items-start">
            <div class="d-flex flex-column gap-3">
                <BaseBreadcrumb items={breadcrumbItems} icon={IconChartCircles} />
                <div>
                    <h2 class="mb-1">{connectionTypeName}</h2>
                    {#if connectionDescription}
                        <p class="text-muted mb-0 text-nowrap text-truncate" style="max-width: 800px;">{connectionDescription}</p>
                    {/if}
                </div>
                <div class="d-flex align-items-center gap-1">
                    {#if isPublished}
                        <IconEye size={16} class="text-secondary flex-shrink-0" />
                        <span class="small text-secondary">{t("connections.visible-on-website", { fallback: "Visible on website" })}</span>
                    {:else}
                        <IconEyeOff size={16} class="text-secondary flex-shrink-0" />
                        <span class="small text-secondary">{t("connections.not-visible", { fallback: "Not visible" })}</span>
                    {/if}
                </div>
            </div>
            <div class="d-flex align-items-start gap-2">
                <a href="/projects/{data.project.id}/connections/{data.researchField.id}/edit" class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1">
                    <IconPencil size={14} />
                    {t("common.edit-connection-type", { fallback: "Edit connection type" })}
                </a>
                <BaseDropdownMenu
                    align="end"
                    side="bottom"
                    sideOffset={4}
                    alignOffset={0}
                    contentProps={{ style: "right: 0; left: auto;" }}
                    triggerClass="btn btn-outline-secondary btn-sm d-flex align-items-center"
                >
                    {#snippet trigger()}
                        <IconDotsVertical size={16} />
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
                                <IconDownload size={16} />
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
                            <IconTrash size={16} />
                            {t("common.delete", { fallback: "Delete" })}
                        </button>
                    {/snippet}
                </BaseDropdownMenu>
            </div>
        </div>
    </div>

    <!-- Content with standard padding -->
    <div class="flex-grow-1 d-flex flex-column px-4">
        <BaseSearchBar bind:search={searchTerm} placeholder={searchPlaceholder}>
            {#snippet children()}
                <a href={`/projects/${data.project.id}/connections/${data.researchField.id}/add`} class="btn btn-secondary btn-sm d-flex align-items-center gap-1 text-white">
                    <IconPlus size={14} />
                    {t("common.add-connection", { fallback: "Add connection" })}
                </a>
            {/snippet}
        </BaseSearchBar>

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

        <div class="row g-3">
            {#each paginatedVocabularies as vocabulary (vocabulary.id)}
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <ConnectionVocabularyChip
                        {vocabulary}
                        borderStartClass={colorClasses.border}
                        onOpen={goToDetail}
                        onDuplicate={handleDuplicate}
                        onDelete={openDeleteModal}
                        untitledLabel={t("common.untitled", { fallback: "Untitled" })}
                        duplicateLabel={t("common.duplicate", { fallback: "Duplicate" })}
                        deleteLabel={t("common.delete", { fallback: "Delete" })}
                        imageAltFallback="Connection image"
                    />
                </div>
            {/each}
            {#if filteredVocabularies.length === 0}
                <div class="col-12 text-center text-muted py-5" style="border: 1px dashed var(--bs-secondary); border-radius: 0.375rem;">
                    {data.researchField.vocabularies.length === 0
                        ? t("connections.no-connections-present", { fallback: "No connections present." })
                        : t("common.no-connections-found", { fallback: "No connections found." })}
                </div>
            {/if}
        </div>

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
</div>

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
{/if}
