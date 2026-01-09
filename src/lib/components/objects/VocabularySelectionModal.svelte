<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { addVocabulary as addVocabularyAPI } from "$lib/stores/ResearchFieldsUtils.js";
    import { getAssetImageUrl } from "$lib/utils/media.js";

    // Props
    let {
        isOpen = $bindable(false),
        field = null,
        vocabularyFields = $bindable([]),
        currentSelections = $bindable([]), // Array of { fieldId, vocabularyId }
        onSave = null,
        onCancel = null,
        defaultLanguageId = null,
    } = $props();

    const { t } = getTranslationStore();

    // Local state
    let searchQuery = $state("");
    let selectedFieldId = $state("all");
    let isCreating = $state(false);
    let creationError = $state(null);
    // Track vocabularies created during this modal session so parent can merge/display them
    let createdVocabularies = $state([]);

    // Reset search when modal opens
    let previousIsOpen = $state(false);
    const resetSearchOnOpen = $derived.by(() => {
        if (isOpen && !previousIsOpen) {
            searchQuery = "";
            selectedFieldId = "all"; // Default to 'all'
            creationError = null;
            isCreating = false;
            createdVocabularies = [];
        }
        previousIsOpen = isOpen;
        return null; // derived.by must return something
    });

    // Get the currently selected field from vocabularyFields
    const currentField = $derived.by(() => {
        if (selectedFieldId === "all") return null; // null means all fields
        if (!selectedFieldId) return field;
        return vocabularyFields.find(f => f.id === selectedFieldId) || field;
    });

    // Get vocabulary IDs selected for the current field (or all if 'all' selected)
    const selectedIdsForCurrentField = $derived.by(() => {
        if (selectedFieldId === "all") {
            // Return all selected vocabulary IDs across all fields
            return currentSelections.map(sel => sel.vocabularyId);
        }
        if (!currentField) return [];
        return currentSelections
            .filter(sel => sel.fieldId === currentField.id)
            .map(sel => sel.vocabularyId);
    });

    // Filter vocabularies based on search and selected field
    const filteredVocabularies = $derived.by(() => {
        let allVocabs = [];
        
        if (selectedFieldId === "all") {
            // Get vocabularies from all fields with field name attached
            vocabularyFields.forEach(field => {
                if (field.vocabularies) {
                    field.vocabularies.forEach(vocab => {
                        allVocabs.push({
                            ...vocab,
                            _fieldId: field.id,
                            _fieldName: field.name?.content || "Unknown"
                        });
                    });
                }
            });
        } else if (currentField?.vocabularies) {
            allVocabs = currentField.vocabularies.map(vocab => ({
                ...vocab,
                _fieldId: currentField.id,
                _fieldName: currentField.name?.content || "Unknown"
            }));
        }

        if (!searchQuery.trim()) return allVocabs;

        return allVocabs.filter((vocab) =>
            vocab.option?.content
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()),
        );
    });

    // Check if vocabulary is selected (field-aware)
    function isSelected(vocabularyId, fieldId) {
        return currentSelections.some(
            sel => sel.vocabularyId === vocabularyId && sel.fieldId === fieldId
        );
    }

    function toggleVocabulary(vocabularyId, fieldId) {
        if (isSelected(vocabularyId, fieldId)) {
            currentSelections = currentSelections.filter(
                (sel) => !(sel.fieldId === fieldId && sel.vocabularyId === vocabularyId)
            );
        } else {
            currentSelections = [...currentSelections, { 
                fieldId, 
                vocabularyId 
            }];
        }
    }

    function handleSave() {
        // Pass back selections with field IDs and any vocabularies created during this session
        onSave?.({
            selections: currentSelections,
            created: createdVocabularies,
        });
    }

    function handleCancel() {
        onCancel?.();
    }

    async function createNewVocabulary() {
        creationError = null;
        const optionText = (searchQuery || "").trim();
        if (!optionText) {
            creationError = t("common.validation.required", {
                fallback: "Value is required",
            });
            return;
        }
        if (!defaultLanguageId) {
            creationError = t(
                "objects.research_fields.default_language_required",
                {
                    fallback:
                        "Default language is required to create a new option.",
                },
            );
            return;
        }
        if (selectedFieldId === "all" || !currentField?.id) {
            creationError = t("objects.connections.select_specific_type", {
                fallback: "Please select a specific connection type to create a new item.",
            });
            return;
        }

        isCreating = true;
        try {
            const { result, error } = await addVocabularyAPI(currentField.id, {
                languageId: defaultLanguageId,
                option: optionText,
                description: "",
            });
            if (error) {
                creationError =
                    typeof error === "string"
                        ? error
                        : error?.message || "Failed to create vocabulary";
                return;
            }

            // Extract new vocabulary id from multi-step mutation result
            const newId = result?.insertIntoVocabularies?.[0]?.id;
            if (!newId) {
                creationError = "Failed to obtain new vocabulary ID.";
                return;
            }

            const newVocab = {
                id: newId,
                mainAsset: null,
                vocabulariesGenericAssets: [],
                option: { content: optionText },
                description: { content: "" },
            };

            // Update vocabularyFields to show the new item immediately
            const fieldIndex = vocabularyFields.findIndex(f => f.id === currentField.id);
            if (fieldIndex !== -1) {
                const existing = Array.isArray(vocabularyFields[fieldIndex].vocabularies)
                    ? vocabularyFields[fieldIndex].vocabularies
                    : [];
                vocabularyFields[fieldIndex] = { 
                    ...vocabularyFields[fieldIndex], 
                    vocabularies: [newVocab, ...existing] 
                };
                // Trigger reactivity
                vocabularyFields = [...vocabularyFields];
            }

            // Remember the created vocabulary to send back to parent for merging
            createdVocabularies = [...createdVocabularies, newVocab];

            // Select the newly created vocabulary with its field ID
            currentSelections = [...currentSelections, { 
                fieldId: currentField.id, 
                vocabularyId: newId 
            }];
        } catch (e) {
            creationError =
                e?.message || "Unexpected error while creating vocabulary";
        } finally {
            isCreating = false;
        }
    }
</script>

{#snippet header()}
    {t("objects.connections.select_connection", {
        fallback: "Select Connection",
    })}
{/snippet}

{#snippet body()}
    <!-- Search Bar and Connection Type Filter in a row -->
    <div class="d-flex gap-3 mb-4">
        <!-- Search Bar -->
        <div class="flex-grow-1">
            <div class="position-relative">
                <input
                    type="text"
                    class="form-control pe-5"
                    placeholder={t("common.search", {
                        fallback: "Search connections...",
                    })}
                    bind:value={searchQuery}
                />
                <div class="position-absolute top-50 end-0 translate-middle-y pe-3">
                    <i class="bi bi-search text-muted"></i>
                </div>
            </div>
        </div>

        <!-- Connection Type Filter -->
        <div style="min-width: 200px;">
            <select 
                class="form-select"
                bind:value={selectedFieldId}
            >
                <option value="all">
                    {t("objects.connections.all_types", { fallback: "All connection types" })}
                </option>
                {#each vocabularyFields as vocabField}
                    <option value={vocabField.id}>
                        {vocabField.name?.content || "Unnamed field"}
                    </option>
                {/each}
            </select>
        </div>
    </div>

    <!-- Vocabulary List -->
    <div class="vocabulary-list" style="max-height: 400px; overflow-y: auto;">
        {#each filteredVocabularies as vocab (`${vocab._fieldId}_${vocab.id}`)}
            <div class="d-flex align-items-center p-3 border-bottom">
                <!-- Main Asset Image -->
                <div class="me-3">
                    <BaseImage
                        src={getAssetImageUrl(vocab.mainAsset, 'sm')}
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
                    {#if selectedFieldId === "all"}
                        <small class="text-muted">
                            {vocab._fieldName}
                        </small>
                    {:else if vocab.description?.content}
                        <small class="text-muted">
                            {vocab.description.content}
                        </small>
                    {/if}
                </div>

                <!-- Add/Added button -->
                <div class="ms-3">
                    {#if isSelected(vocab.id, vocab._fieldId)}
                        <BaseButton
                            class="btn btn-sm btn-success"
                            icon="check"
                            text={t("common.added", { fallback: "Added" })}
                            onClick={() => toggleVocabulary(vocab.id, vocab._fieldId)}
                        />
                    {:else}
                        <BaseButton
                            class="btn btn-sm btn-outline-secondary"
                            icon="plus"
                            text={t("common.add", { fallback: "Add" })}
                            onClick={() => toggleVocabulary(vocab.id, vocab._fieldId)}
                        />
                    {/if}
                </div>
            </div>
        {/each}

        {#if filteredVocabularies.length === 0}
            <div class="text-center py-4 text-muted">
                {#if searchQuery.trim()}
                    <div class="mb-2 ps-3 d-flex justify-content-start">
                        {t("common.no_results", {
                            fallback: "No results found",
                        })}
                    </div>
                    <BaseButton
                        class="btn btn-link text-dark text-decoration-none"
                        icon="plus-circle"
                        text={`Create "${searchQuery.trim()}"`}
                        onClick={createNewVocabulary}
                        disabled={!defaultLanguageId || isCreating || selectedFieldId === "all"}
                    />
                    {#if selectedFieldId === "all"}
                        <div class="small mt-2">
                            {t(
                                "objects.connections.select_specific_type",
                                {
                                    fallback:
                                        "Please select a specific connection type to create a new item.",
                                },
                            )}
                        </div>
                    {/if}
                    {#if !defaultLanguageId}
                        <div class="small mt-2">
                            {t(
                                "objects.research_fields.default_language_required",
                                {
                                    fallback:
                                        "Default language is required to create a new option.",
                                },
                            )}
                        </div>
                    {/if}
                    {#if creationError}
                        <div class="text-danger small mt-2">
                            {creationError}
                        </div>
                    {/if}
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
            disabled={currentSelections.length === 0}
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
