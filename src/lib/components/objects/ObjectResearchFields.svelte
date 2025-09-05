<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import VocabularySelectionModal from "./VocabularySelectionModal.svelte";
    import { updateObjectResearchFields } from "$lib/stores/ObjectsUtils.js";
    import { invalidate } from "$app/navigation";
    // Props
    const {
        object,
        researchFields = [],
        onSave = null,
        onChangesUpdate = null, // Callback to notify parent of changes
    } = $props();

    const { t } = getTranslationStore();

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

    // Merge project research fields with object's current values
    const allResearchFields = $derived.by(() => {
        return researchFields.map((field) => {
            const objectValue = getFieldObjectValue(field);
            const vocabularyValues = getFieldVocabularyValues(field);
            const pendingChangesForField = getPendingChangesForField(field.id);

            let currentValue = objectValue?.value || "";
            let currentVocabularyIds = vocabularyValues.map(
                (v) => v.vocabulary_id,
            );

            // Apply pending vocabulary changes
            currentVocabularyIds = applyPendingChanges(
                currentVocabularyIds,
                pendingChangesForField,
            );

            // Apply pending text changes
            const textChange = pendingChanges.get(field.id);
            if (textChange?.value !== undefined && !textChange.vocabularyId) {
                currentValue = textChange.value;
            }

            return {
                ...field,
                objectValue: objectValue || null,
                currentValue,
                currentVocabularyIds,
                hasValue: !!currentValue || currentVocabularyIds.length > 0,
            };
        });
    });

    // Track pending changes
    let pendingChanges = $state(new Map());

    // Modal state
    let isModalOpen = $state(false);
    let currentModalField = $state(null);

    // Derived state to check if there are unsaved changes
    const hasChanges = $derived(pendingChanges.size > 0);

    // Helper function to notify parent
    function notifyParent() {
        if (onChangesUpdate) {
            onChangesUpdate({
                component: "research_fields",
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

    // Functions for handling field updates
    function handleFreeTextChange(fieldId, value) {
        const objectField = getFieldObjectValue({ id: fieldId });
        updatePendingChange(fieldId, {
            id: objectField?.id,
            fieldId: objectField?.id ? null : fieldId,
            value,
            vocabularyId: null,
        });
    }

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
        currentModalField = {
            ...field,
            currentVocabularyIds: field.currentVocabularyIds || [],
        };
        isModalOpen = true;
    };

    const handleModalSave = (vocabularyIds) => {
        if (currentModalField && vocabularyIds?.length > 0) {
            vocabularyIds.forEach((vocabularyId) => {
                handleVocabularyAdd(currentModalField.id, vocabularyId);
            });
        }
        closeModal();
    };

    // Save all pending changes
    async function saveChanges() {
        if (pendingChanges.size === 0) return;

        isSaving = true;
        try {
            const changes = Array.from(pendingChanges.values());
            const result = await updateObjectResearchFields(object.id, changes);

            if (result.error) {
                console.error("Error saving changes:", result.error);
                // TODO: Show user error message
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
</script>

<div class="bg-white p-4 mb-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
        <h3 class="mb-0">
            {t("objects.research_fields.title", { fallback: "Research data" })}
        </h3>
    </div>

    {#if allResearchFields.length === 0}
        <div class="text-muted">
            {t("objects.research_fields.no_fields", {
                fallback: "No research fields defined for this project",
            })}
        </div>
    {:else}
        <!-- Research fields with direct editing -->
        <div class="row">
            {#each allResearchFields as field}
                <div class="col-md-7 mb-2">
                    <div class="p-3 rounded">
                        <div
                            class="d-flex justify-content-between align-items-start mb-2"
                        >
                            <div class="fw-semibold">
                                {field.name?.content || "Unnamed field"}
                            </div>
                        </div>

                        {#if field.type === "vocabulary"}
                            <!-- Vocabulary field with add/remove buttons -->
                            <div class="vocabulary-field">
                                {#if field.currentVocabularyIds?.length > 0}
                                    <!-- Show current selections with remove buttons -->
                                    {#each field.currentVocabularyIds as vocabId}
                                        {@const vocab =
                                            field.vocabularies?.find(
                                                (v) => v.id === vocabId,
                                            )}
                                        {#if vocab}
                                            <div
                                                class="d-flex align-items-center gap-2 mb-2 p-2 border border-secondary border-opacity-50 rounded"
                                            >
                                                <div class="me-2">
                                                    <BaseImage
                                                        src={vocab.mainAsset
                                                            ?.path
                                                            ? `media://${vocab.mainAsset.path}`
                                                            : null}
                                                        alt={vocab.option
                                                            ?.content ||
                                                            "Vocabulary option"}
                                                        width={32}
                                                        height={32}
                                                        class="rounded"
                                                        ratio="1/1"
                                                    />
                                                </div>
                                                <span class="flex-grow-1">
                                                    {vocab.option?.content ||
                                                        "Unnamed option"}
                                                </span>
                                                <BaseButton
                                                    class="btn btn-link text-dark p-0 text-decoration-none"
                                                    onClick={() =>
                                                        handleVocabularyRemove(
                                                            field.id,
                                                            vocab.id,
                                                        )}
                                                    icon="x-circle"
                                                    text=""
                                                />
                                            </div>
                                        {/if}
                                    {/each}
                                {:else}
                                    <div
                                        class="text-muted mb-2 p-2 border border-secondary border-opacity-50 rounded"
                                        style="border-style: dashed !important;"
                                    >
                                        {t("objects.research_fields.no_value", {
                                            fallback: "No value selected",
                                        })}
                                    </div>
                                {/if}

                                <!-- Add vocabulary button -->
                                <BaseButton
                                    class="btn btn-sm btn-outline-secondary"
                                    icon="plus"
                                    text={t(
                                        "objects.research_fields.add_value",
                                        { fallback: "Add value" },
                                    )}
                                    onClick={() => openVocabularyModal(field)}
                                />
                            </div>
                        {:else}
                            <!-- Free text field with direct input -->
                            <textarea
                                class="form-control"
                                rows="3"
                                value={field.currentValue}
                                placeholder={t(
                                    "objects.research_fields.enter_value",
                                    { fallback: "Enter value..." },
                                )}
                                oninput={(e) =>
                                    handleFreeTextChange(
                                        field.id,
                                        e.target.value,
                                    )}
                            ></textarea>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>

<!-- Vocabulary Selection Modal -->
<VocabularySelectionModal
    bind:isOpen={isModalOpen}
    field={currentModalField}
    currentVocabularyIds={currentModalField?.currentVocabularyIds || []}
    onSave={handleModalSave}
    onCancel={closeModal}
/>
