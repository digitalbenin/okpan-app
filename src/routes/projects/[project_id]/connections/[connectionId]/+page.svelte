<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { goto, invalidateAll } from "$app/navigation";
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
    import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
    import ConnectionVocabularyChip from "$lib/components/research_fields/ConnectionVocabularyChip.svelte";
    import ConnectionHeader from "$lib/components/research_fields/ConnectionHeader.svelte";
    import ConnectionDialogs from "$lib/components/research_fields/ConnectionDialogs.svelte";
    import { getTemplateColorClasses } from "$lib/constants/connectionTemplates.js";
    import { addVocabulary, deleteVocabulary } from "$lib/api/ResearchFieldsApi.js";
    import {
        IconCirclePlus,
        IconChevronDown,
        IconSortAscendingLetters,
        IconSortDescendingLetters,
        IconSortAscendingNumbers,
        IconSortDescendingNumbers,
    } from "@tabler/icons-svelte";

    const { data } = $props();
    const { t } = getTranslationStore();

    let searchTerm = $state("");
    let currentPage = $state(1);
    let itemsPerPage = $state(24);
    let sortOrder = $state("name_asc");
    let sortOpen = $state(false);

    const sortOptions = $derived([
        { label: t("common.sort-by-name", { fallback: "Sort by name" }), icon: IconSortAscendingLetters, value: "name_asc" },
        { label: t("common.sort-by-name-desc", { fallback: "Sort by name (Z-A)" }), icon: IconSortDescendingLetters, value: "name_desc" },
        { label: t("common.sort-by-objects", { fallback: "Sort by objects" }), icon: IconSortDescendingNumbers, value: "objects_desc" },
        { label: t("common.sort-by-objects", { fallback: "Sort by objects" }), icon: IconSortAscendingNumbers, value: "objects_asc" },
    ]);

    const currentSort = $derived(sortOptions.find(o => o.value === sortOrder) ?? sortOptions[0]);

    let deleteVocabOpen = $state(false);
    let deleteVocabItem = $state(null);
    let isExportingCsv = $state(false);

    let vocabularies = $derived(data.researchField?.vocabularies || []);
    let templateId = $derived(data.researchField?.fields_config?.templateId || null);
    let colorClasses = $derived(getTemplateColorClasses(templateId));
    let searchPlaceholder = $derived(t("common.search", { fallback: "Search" }));

    let filteredVocabularies = $derived(
        searchTerm
            ? vocabularies.filter(v => v.option?.content?.toLowerCase().includes(searchTerm.toLowerCase()))
            : vocabularies
    );

    let sortedVocabularies = $derived(
        [...filteredVocabularies].sort((a, b) => {
            const nameA = a.option?.content?.toLowerCase() || "";
            const nameB = b.option?.content?.toLowerCase() || "";
            if (sortOrder === "name_desc") return nameB.localeCompare(nameA);
            if (sortOrder === "name_asc") return nameA.localeCompare(nameB);
            const countA = getObjectsCount(a);
            const countB = getObjectsCount(b);
            if (sortOrder === "objects_desc") return countB - countA;
            if (sortOrder === "objects_asc") return countA - countB;
            return 0;
        })
    );

    let paginatedVocabularies = $derived(
        sortedVocabularies.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    );

    function getObjectsCount(vocabulary) {
        return vocabulary?.objectsResearchFields?.length ?? 0;
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
        deleteVocabItem = vocab;
        deleteVocabOpen = true;
    }

    async function confirmDelete() {
        if (!deleteVocabItem) return;
        const { error } = await deleteVocabulary(deleteVocabItem.id);
        if (!error) await invalidateAll();
        deleteVocabOpen = false;
        deleteVocabItem = null;
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
    <ConnectionHeader
        projectId={data.project.id}
        researchField={data.researchField}
        isExporting={isExportingCsv}
        onExport={handleExportCsv}
    />

    <!-- Content with standard padding -->
    <div class="flex-grow-1 d-flex flex-column px-4">
        <BaseSearchBar bind:search={searchTerm} placeholder={searchPlaceholder}>
            {#snippet children()}
                <a href={`/projects/${data.project.id}/connections/${data.researchField.id}/add`} class="btn btn-primary btn-sm d-flex align-items-center gap-1 text-white">
                    <IconCirclePlus size={14} />
                    {t("common.add-connection", { fallback: "Add connection" })}
                </a>
            {/snippet}
        </BaseSearchBar>

        <div class="d-flex justify-content-between align-items-center mb-3">
            <div class="text-muted">
                {filteredVocabularies.length} {t("common.connections", { fallback: "connections" })}
            </div>
            <div class="d-flex align-items-center gap-2">
                <BaseDropdownMenu
                    bind:open={sortOpen}
                    contentProps={{ style: "right: 0; left: auto;" }}
                    side="bottom"
                    align="end"
                    triggerClass="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                >
                    {#snippet trigger()}
                        {currentSort.label}
                        <IconChevronDown size={16} />
                    {/snippet}
                    {#snippet children()}
                        {#each sortOptions as option}
                            <button
                                type="button"
                                class="dropdown-item rounded px-2 py-1 d-flex align-items-center gap-2"
                                class:active={sortOrder === option.value}
                                onclick={() => { sortOrder = option.value; sortOpen = false; }}
                            >
                                <option.icon size={16} class="text-body-secondary" />
                                <span class="flex-grow-1">{option.label}</span>
                            </button>
                        {/each}
                    {/snippet}
                </BaseDropdownMenu>
            </div>
        </div>

        <div class="row g-3">
            {#each paginatedVocabularies as vocabulary (vocabulary.id)}
                <div class="col-md-6 col-lg-4 col-xl-3">
                    <ConnectionVocabularyChip
                        {vocabulary}
                        objectsCount={getObjectsCount(vocabulary)}
                        borderStartClass={colorClasses.border}
                        onOpen={goToDetail}
                        onDuplicate={handleDuplicate}
                        onDelete={openDeleteModal}
                        untitledLabel={t("common.untitled", { fallback: "Untitled" })}
                        duplicateLabel={t("common.duplicate", { fallback: "Duplicate" })}
                        deleteLabel={t("common.delete", { fallback: "Delete" })}
                        objectsCountLabel={t("common.objects", { fallback: "objects" })}
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

        {#if filteredVocabularies.length > itemsPerPage}
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

<ConnectionDialogs
    bind:deleteVocabOpen
    {confirmDelete}
/>
{/if}
