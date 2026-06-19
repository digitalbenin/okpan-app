<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { updateObjectResearchFields } from "$lib/api/ObjectsApi.js";
    import { invalidate } from "$app/navigation";
    // Props
    const {
        object,
        researchFields = [],
        onSave = null,
        onChangesUpdate = null, // Callback to notify parent of changes
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

    // Merge project research fields with object's current values (free-text only)
    const allResearchFields = $derived.by(() => {
        return researchFields
            .filter((field) => field.type !== "vocabulary")
            .map((field) => {
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



    // Save all pending changes
    async function saveChanges(objectIdToSave) {
        if (pendingChanges.size === 0) return;

        const objectId = objectIdToSave || object?.id;
        if (!objectId) {
            console.error("No object ID provided to save research fields.");
            return;
        }

        isSaving = true;
        try {
            const changes = Array.from(pendingChanges.values());
            const result = await updateObjectResearchFields(objectId, changes);

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

<div class="d-flex flex-column gap-3">
    {#if allResearchFields.length === 0}
        <div class="text-muted small">
            {t("objects.research_fields.no_fields", {
                fallback: "No research fields defined for this project",
            })}
        </div>
    {:else}
        {#each allResearchFields as field}
            <div>
                <label class="form-label mb-2">
                    {field.name?.content || t("common.unnamed-field", { fallback: "Unnamed field" })}
                </label>
                <textarea
                    class="form-control"
                    rows="3"
                    value={field.currentValue}
                    placeholder={t(
                        "objects.research_fields.enter_value",
                        { fallback: "Write here.." },
                    )}
                    oninput={(e) =>
                        handleFreeTextChange(
                            field.id,
                            e.target.value,
                        )}
                ></textarea>
            </div>
        {/each}
    {/if}
</div>
