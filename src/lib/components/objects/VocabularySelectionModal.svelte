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
        vocabularyFields = [],
        currentSelections = $bindable([]), // Array of { fieldId, vocabularyId }
        onSave = null,
        onCancel = null,
        defaultLanguageId = null,
    } = $props();

    const { t } = getTranslationStore();

    // Local state
    let searchQuery = $state("");
    let selectedFieldId = $state(null);
    let isCreating = $state(false);
    let creationError = $state(null);
    // Track vocabularies created during this modal session so parent can merge/display them
    let createdVocabularies = $state([]);

    // Reset search when modal opens
    let previousIsOpen = $state(false);
    const resetSearchOnOpen = $derived.by(() => {
        if (isOpen && !previousIsOpen) {
            searchQuery = "";
            selectedFieldId = field?.id || vocabularyFields[0]?.id || null;
            creationError = null;
            isCreating = false;
            createdVocabularies = [];
        }
        previousIsOpen = isOpen;
        return null; // derived.by must return something
    });

    // Get the currently selected field from vocabularyFields
    const currentField = $derived.by(() => {
        if (!selectedFieldId) return field;
        return vocabularyFields.find(f => f.id === selectedFieldId) || field;
    });

    // Get vocabulary IDs selected for the current field only
    const selectedIdsForCurrentField = $derived.by(() => {
        if (!currentField) return [];
        return currentSelections
            .filter(sel => sel.fieldId === currentField.id)
            .map(sel => sel.vocabularyId);
    });

    // Filter vocabularies based on search
    const filteredVocabularies = $derived.by(() => {
        if (!currentField?.vocabularies) return [];

        const vocabularies = currentField.vocabularies;
        if (!searchQuery.trim()) return vocabularies;

        return vocabularies.filter((vocab) =>
            vocab.option?.content
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()),
        );
    });

    // Check if vocabulary is selected in the current field
    function isSelected(vocabularyId) {
        return selectedIdsForCurrentField.includes(vocabularyId);
    }

    function toggleVocabulary(vocabularyId) {
        if (!currentField) return;
        
        if (isSelected(vocabularyId)) {
            currentSelections = currentSelections.filter(
                (sel) => !(sel.fieldId === currentField.id && sel.vocabularyId === vocabularyId)
            );
        } else {
            currentSelections = [...currentSelections, { 
                fieldId: currentField.id, 
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
        if (!currentField?.id) {
            creationError = t("objects.research_fields.field_missing", {
                fallback: "Research field is missing.",
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

            // Update local field reference so list shows the new item on top
            const existing = Array.isArray(currentField?.vocabularies)
                ? currentField.vocabularies
                : [];
            
            // Update in vocabularyFields array if this is not the main field
            if (vocabularyFields.length > 0 && selectedFieldId) {
                const fieldIndex = vocabularyFields.findIndex(f => f.id === selectedFieldId);
                if (fieldIndex !== -1) {
                    vocabularyFields[fieldIndex] = { ...vocabularyFields[fieldIndex], vocabularies: [newVocab, ...existing] };
                }
            } else if (field) {
                field = { ...field, vocabularies: [newVocab, ...existing] };
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
    {t("objects.research_fields.select_value", {
        fallback: `Select ${currentField?.name?.content || field?.name?.content || "value"}`,
    })}
{/snippet}

{#snippet body()}
    <!-- Vocabulary Field Filter (only show if multiple fields available) -->
    {#if vocabularyFields.length > 1}
        <div class="mb-3">
            <label class="form-label small text-muted">
                {t("objects.connections.select_vocabulary_type", { fallback: "Select vocabulary type" })}
            </label>
            <select 
                class="form-select"
                bind:value={selectedFieldId}
            >
                {#each vocabularyFields as vocabField}
                    <option value={vocabField.id}>
                        {vocabField.name?.content || "Unnamed field"}
                    </option>
                {/each}
            </select>
        </div>
    {/if}

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
                        disabled={!defaultLanguageId || isCreating}
                    />
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
