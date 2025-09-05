<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";

    // Props
    let {
        isOpen = $bindable(false),
        field = null,
        currentVocabularyIds = $bindable([]),
        onSave = null,
        onCancel = null,
    } = $props();

    const { t } = getTranslationStore();

    // Local state
    let searchQuery = $state("");

    // Derived selectedIds that reactively follows currentVocabularyIds
    let selectedIds = $derived([...(currentVocabularyIds || [])]);

    // Reset search when modal opens
    let previousIsOpen = $state(false);
    const resetSearchOnOpen = $derived.by(() => {
        if (isOpen && !previousIsOpen) {
            searchQuery = "";
        }
        previousIsOpen = isOpen;
        return null; // derived.by must return something
    });

    // Filter vocabularies based on search
    const filteredVocabularies = $derived.by(() => {
        if (!field?.vocabularies) return [];

        const vocabularies = field.vocabularies;
        if (!searchQuery.trim()) return vocabularies;

        return vocabularies.filter((vocab) =>
            vocab.option?.content
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()),
        );
    });

    // Check if vocabulary is selected
    function isSelected(vocabularyId) {
        return selectedIds.includes(vocabularyId);
    }

    function toggleVocabulary(vocabularyId) {
        if (isSelected(vocabularyId)) {
            currentVocabularyIds = currentVocabularyIds.filter(
                (id) => id !== vocabularyId,
            );
        } else {
            currentVocabularyIds = [...currentVocabularyIds, vocabularyId];
        }
    }

    function handleSave() {
        onSave?.(selectedIds);
    }

    function handleCancel() {
        onCancel?.();
    }

    // Debug
    $inspect({
        isOpen,
        currentVocabularyIds,
        selectedIds,
        fieldName: field?.name?.content,
    });
</script>

{#snippet header()}
    {t("objects.research_fields.select_value", {
        fallback: `Select ${field?.name?.content || "value"}`,
    })}
{/snippet}

{#snippet body()}
    <!-- Search Bar -->
    <div class="mb-4">
        <div class="position-relative">
            <input
                type="text"
                class="form-control pe-5"
                placeholder={t("common.search", {
                    fallback: "Content",
                })}
                bind:value={searchQuery}
            />
            <div class="position-absolute top-50 end-0 translate-middle-y pe-3">
                <i class="bi bi-search text-muted"></i>
            </div>
        </div>
    </div>

    <!-- Vocabulary List -->
    <div class="vocabulary-list" style="max-height: 400px; overflow-y: auto;">
        {#each filteredVocabularies as vocab (vocab.id)}
            <div class="d-flex align-items-center p-3 border-bottom">
                <!-- Main Asset Image -->
                <div class="me-3">
                    <BaseImage
                        src={vocab.mainAsset?.formats?.sm
                            ? `media://${vocab.mainAsset.formats.sm}`
                            : null}
                        alt={vocab.option?.content || "Vocabulary option"}
                        width={48}
                        height={48}
                        class="rounded"
                        ratio="1/1"
                    />
                </div>

                <!-- Vocabulary content -->
                <div class="flex-grow-1">
                    <div class="fw-medium">
                        {vocab.option?.content || "Unnamed option"}
                    </div>
                    {#if vocab.description?.content}
                        <small class="text-muted">
                            {vocab.description.content}
                        </small>
                    {/if}
                </div>

                <!-- Add/Added button -->
                <div class="ms-3">
                    {#if isSelected(vocab.id)}
                        <BaseButton
                            class="btn btn-sm btn-success"
                            icon="check"
                            text={t("common.added", { fallback: "Added" })}
                            onClick={() => toggleVocabulary(vocab.id)}
                        />
                    {:else}
                        <BaseButton
                            class="btn btn-sm btn-outline-secondary"
                            icon="plus"
                            text={t("common.add", { fallback: "Add" })}
                            onClick={() => toggleVocabulary(vocab.id)}
                        />
                    {/if}
                </div>
            </div>
        {/each}

        {#if filteredVocabularies.length === 0}
            <div class="text-center py-4 text-muted">
                {#if searchQuery.trim()}
                    {t("common.no_results", {
                        fallback: "No results found",
                    })}
                {:else}
                    {t("objects.research_fields.no_vocabularies", {
                        fallback: "No vocabulary options available",
                    })}
                {/if}
            </div>
        {/if}
    </div>
{/snippet}

{#snippet actions()}
    <div class="d-flex justify-content-end gap-2">
        <BaseButton
            class="btn btn-outline-secondary"
            text={t("common.cancel", { fallback: "Cancel" })}
            onClick={handleCancel}
        />
        <BaseButton
            class="btn btn-success"
            text={t("common.save", { fallback: "Save" })}
            onClick={handleSave}
            disabled={selectedIds.length === 0}
        />
    </div>
{/snippet}

<BaseModal bind:isOpen size="lg" {header} {body} {actions} />

<style>
    .vocabulary-list::-webkit-scrollbar {
        width: 6px;
    }

    .vocabulary-list::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }

    .vocabulary-list::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }

    .vocabulary-list::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
</style>
