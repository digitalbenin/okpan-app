<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import VocabularySelectionModal from "./VocabularySelectionModal.svelte";
    import { updateObjectResearchFields, getConnectionFieldColor } from "$lib/stores/ObjectsUtils.js";
    import { invalidate } from "$app/navigation";

    // Props
    const {
        object,
        researchFields = [],
        onSave = null,
        onChangesUpdate = null,
        defaultLanguageId = null,
    } = $props();

    const { t } = getTranslationStore();

    // State management
    let isSaving = $state(false);

    // Get object's current research field values
    const objectResearchFieldValues = $derived(
        object?.objectsResearchFields || [],
    );

    // Helper functions for field processing
    const getFieldObjectValue = (field) =>
        objectResearchFieldValues.find(
            (objField) => objField.researchField.id === field.id,
        );

    const getFieldVocabularyValues = (field) =>
        objectResearchFieldValues.filter(
            (objField) =>
                objField.researchField.id === field.id &&
                objField.vocabulary_id,
        );

    const getPendingChangesForField = (fieldId) =>
        Array.from(pendingChanges.entries())
            .filter(([key]) => key.startsWith(`${fieldId}_`))
            .map(([key, change]) => ({ ...change, key }));

    const applyPendingChanges = (
        currentVocabularyIds,
        pendingChangesForField,
    ) => {
        return pendingChangesForField.reduce((ids, change) => {
            if (change.action === "delete") {
                return ids.filter((id) => id !== change.vocabularyId);
            }
            if (
                change.vocabularyId &&
                !change.action &&
                !ids.includes(change.vocabularyId)
            ) {
                return [...ids, change.vocabularyId];
            }
            return ids;
        }, currentVocabularyIds);
    };

    // Merge project research fields with object's current values (vocabulary-type only)
    const allVocabularyFields = $derived.by(() => {
        return researchFields
            .filter((field) => field.type === "vocabulary")
            .map((field) => {
                const objectValue = getFieldObjectValue(field);
                const vocabularyValues = getFieldVocabularyValues(field);
                const pendingChangesForField = getPendingChangesForField(field.id);

                let currentVocabularyIds = vocabularyValues.map(
                    (v) => v.vocabulary_id,
                );

                // Apply pending vocabulary changes
                currentVocabularyIds = applyPendingChanges(
                    currentVocabularyIds,
                    pendingChangesForField,
                );

                return {
                    ...field,
                    objectValue: objectValue || null,
                    currentVocabularyIds,
                    hasValue: currentVocabularyIds.length > 0,
                };
            });
    });

    // Track pending changes
    let pendingChanges = $state(new Map());

    // Modal state
    let isModalOpen = $state(false);
    let currentModalField = $state(null);
    let currentSelections = $state([]);
    let originalSelections = $state([]); // Store original before modal changes

    // Derived state to check if there are unsaved changes
    const hasChanges = $derived(pendingChanges.size > 0);

    // Helper function to notify parent
    function notifyParent() {
        if (onChangesUpdate) {
            onChangesUpdate({
                component: "connections",
                hasChanges: pendingChanges.size > 0,
                changes: Array.from(pendingChanges.values()),
                saveFunction: saveChanges,
            });
        }
    }

    // Generic function to update pending changes and notify parent
    const updatePendingChange = (key, change) => {
        if (change === null) {
            pendingChanges.delete(key);
        } else {
            pendingChanges.set(key, change);
        }
        pendingChanges = new Map(pendingChanges);
        notifyParent();
    };

    function handleVocabularyAdd(fieldId, vocabularyId) {
        const objectField = objectResearchFieldValues.find(
            (objField) =>
                objField.researchField.id === fieldId &&
                objField.vocabulary_id === vocabularyId,
        );

        const changeKey = `${fieldId}_${vocabularyId}`;
        updatePendingChange(changeKey, {
            id: objectField?.id,
            fieldId: objectField?.id ? null : fieldId,
            value: null,
            vocabularyId,
        });
    }

    function handleVocabularyRemove(fieldId, vocabularyId) {
        const objectField = objectResearchFieldValues.find(
            (objField) =>
                objField.researchField.id === fieldId &&
                objField.vocabulary_id === vocabularyId,
        );

        const changeKey = `${fieldId}_${vocabularyId}`;

        if (objectField?.id) {
            updatePendingChange(changeKey, {
                action: "delete",
                id: objectField.id,
                fieldId,
                vocabularyId,
            });
        } else {
            updatePendingChange(changeKey, null);
        }
    }

    // Modal handling functions
    const closeModal = () => {
        isModalOpen = false;
        currentModalField = null;
    };

    const openVocabularyModal = (field) => {
        currentModalField = field;
        
        // Initialize currentSelections from all fields
        const selections = [];
        allVocabularyFields.forEach((field) => {
            field.currentVocabularyIds?.forEach((vocabId) => {
                selections.push({
                    fieldId: field.id,
                    vocabularyId: vocabId
                });
            });
        });
        currentSelections = selections;
        originalSelections = JSON.parse(JSON.stringify(selections)); // Deep copy
        
        isModalOpen = true;
    };

    const handleModalSave = (payload) => {
        const newSelections = payload.selections || [];
        const createdVocabs = payload.created || [];

        // Merge created vocabularies into their respective fields
        if (createdVocabs.length > 0) {
            createdVocabs.forEach(newVocab => {
                const fieldId = newSelections.find(s => s.vocabularyId === newVocab.id)?.fieldId;
                if (fieldId) {
                    const rfIndex = researchFields.findIndex(rf => rf.id === fieldId);
                    if (rfIndex !== -1) {
                        const rf = researchFields[rfIndex];
                        const existing = Array.isArray(rf.vocabularies) ? rf.vocabularies : [];
                        const existingIds = new Set(existing.map(v => v.id));
                        if (!existingIds.has(newVocab.id)) {
                            researchFields[rfIndex] = { ...rf, vocabularies: [newVocab, ...existing] };
                        }
                    }
                }
            });
        }

        // Compare against original selections (before modal changes)
        const oldSelectionKeys = new Set(
            originalSelections.map(s => `${s.fieldId}_${s.vocabularyId}`)
        );
        const newSelectionKeys = new Set(
            newSelections.map(s => `${s.fieldId}_${s.vocabularyId}`)
        );

        // Handle additions (new selections not in old)
        newSelections.forEach(({ fieldId, vocabularyId }) => {
            const key = `${fieldId}_${vocabularyId}`;
            if (!oldSelectionKeys.has(key)) {
                handleVocabularyAdd(fieldId, vocabularyId);
            }
        });

        // Handle removals (old selections not in new)
        originalSelections.forEach(({ fieldId, vocabularyId }) => {
            const key = `${fieldId}_${vocabularyId}`;
            if (!newSelectionKeys.has(key)) {
                handleVocabularyRemove(fieldId, vocabularyId);
            }
        });

        closeModal();
    };

    // Save all pending changes
    async function saveChanges(objectIdToSave) {
        if (pendingChanges.size === 0) return;

        const objectId = objectIdToSave || object?.id;
        if (!objectId) {
            console.error("No object ID provided to save connections.");
            return;
        }

        isSaving = true;
        try {
            const changes = Array.from(pendingChanges.values());
            const result = await updateObjectResearchFields(objectId, changes);

            if (result.error) {
                console.error("Error saving changes:", result.error);
            } else {
                pendingChanges.clear();
                pendingChanges = new Map(pendingChanges);

                // Notify parent that changes are cleared
                notifyParent();

                // Invalidate to refresh data
                invalidate("custom:object");

                if (onSave) {
                    onSave(result.results);
                }
            }
        } catch (error) {
            console.error("Error saving changes:", error);
        } finally {
            isSaving = false;
        }
    }

    // Get all vocabulary items with their field information for display
    const allConnections = $derived.by(() => {
        const connections = [];
        allVocabularyFields.forEach((field) => {
            field.currentVocabularyIds?.forEach((vocabId) => {
                const vocab = field.vocabularies?.find((v) => v.id === vocabId);
                if (vocab) {
                    connections.push({
                        fieldId: field.id,
                        fieldName:
                            field.name?.content ||
                            t("filters.connections", { fallback: "Connections" }),
                        vocabularyId: vocab.id,
                        vocabularyName:
                            vocab.option?.content ||
                            t("common.unnamed", { fallback: "Unnamed" }),
                        vocabularyImage: vocab.mainAsset?.path
                            ? `media://${vocab.mainAsset.path}`
                            : null,
                    });
                }
            });
        });
        return connections;
    });
</script>

<div class="card bg-white mx-0 border-0">
    <div class="card-body">
        <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="d-flex align-items-center gap-2">
                <i class="bi bi-share"></i>
                <span class="">
                    {t("filters.connections", { fallback: "Connections" })}
                </span>
            </div>
            {#if allVocabularyFields.length > 0}
                <BaseButton
                    class="btn btn-sm btn-secondary"
                    icon="plus"
                    text={t("export.add-connection", { fallback: "Add connection" })}
                    onClick={() => openVocabularyModal(allVocabularyFields[0])}
                />
            {/if}
        </div>

        {#if allVocabularyFields.length === 0}
            <div class="text-muted">
                {t("objects.connections.no_fields", {
                    fallback: "No connection fields defined for this project",
                })}
            </div>
        {:else if allConnections.length === 0}
            <div class="text-muted">
                {t("objects.connections.no_connections", {
                    fallback: "No connections added",
                })}
            </div>
        {:else}
            <div class="d-flex flex-wrap gap-2">
                {#each allConnections as connection}
                    <div
                        class="connection-card d-flex align-items-center gap-2 p-2 rounded"
                        style="background-color: {getConnectionFieldColor(connection.fieldName)};"
                    >
                        <div class="connection-image">
                            <BaseImage
                                src={connection.vocabularyImage}
                                alt={connection.vocabularyName}
                                width={40}
                                height={40}
                                class="rounded-circle"
                                ratio="1/1"
                            />
                        </div>
                        <div class="connection-info flex-grow-1">
                            <div class="fw-semibold">
                                {connection.vocabularyName}
                            </div>
                            <div class="text-muted small">
                                {connection.fieldName}
                            </div>
                        </div>
                        <button
                            type="button"
                            class="btn btn-link p-0 text-dark text-decoration-none"
                            aria-label={t("objects.connections.remove", {
                                fallback: "Remove connection",
                            })}
                            onclick={() =>
                                handleVocabularyRemove(
                                    connection.fieldId,
                                    connection.vocabularyId,
                                )}
                        >
                            <i class="bi bi-x-circle"></i>
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Vocabulary Selection Modal -->
<VocabularySelectionModal
    bind:isOpen={isModalOpen}
    field={currentModalField}
    vocabularyFields={allVocabularyFields}
    bind:currentSelections={currentSelections}
    onSave={handleModalSave}
    onCancel={closeModal}
    {defaultLanguageId}
/>

<style>
    .connection-card {
        min-width: 200px;
        max-width: 300px;
        border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .connection-image {
        flex-shrink: 0;
    }

    .connection-info {
        min-width: 0;
    }

    .connection-info > div {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
</style>
