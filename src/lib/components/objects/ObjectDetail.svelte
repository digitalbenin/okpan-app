<script>
    import { createEventDispatcher, getContext } from "svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseSelect from "$lib/components/base/BaseSelect.svelte";

    let { object } = $props();

    // Get research fields from context
    const researchFields = getContext("researchFields") || [];

    const dispatch = createEventDispatcher();

    // Create a simple map to track field changes
    let editedFields = $state({});

    // Track field values for each research field
    let fieldValues = $state({});

    // Keep a reference to the previous field values to avoid circular updates
    let previousFieldValues = $state({});

    // Ensure field values always have a default value
    let safeFieldValues = $derived({
        ...Object.fromEntries(
            Object.entries(fieldValues).map(([key, value]) => [
                key,
                value || "",
            ]),
        ),
    });

    // Detect when object changes to reset edited fields
    $effect(() => {
        if (
            object &&
            object.objectsResearchFields &&
            object.objectsResearchFields.length > 0
        ) {
            // Reset edits tracking
            editedFields = {};

            // Initialize field values
            const values = {};
            object.objectsResearchFields.forEach((field, index) => {
                const fieldId = field.id || `field-${index}`;

                // Ensure we have default values
                if (field.vocabulary_id) {
                    // For vocabulary fields, show the vocabulary ID
                    values[fieldId] = field.vocabulary_id || "";
                } else {
                    // Otherwise use the value directly
                    values[fieldId] = field.value || "";
                }
            });

            fieldValues = values;
            previousFieldValues = { ...values };
            console.log("Field values initialized:", values);
        } else {
            console.log("No research fields found for object:", object?.id);
            fieldValues = {};
            previousFieldValues = {};
            editedFields = {};
        }
    });

    // Simple function to check if any fields have changed
    function hasChanges() {
        return Object.keys(editedFields).length > 0;
    }

    // Simpler function to handle input changes
    function handleInputChange(fieldId, value) {
        if (!fieldId) return;

        // Find the original field
        const originalField = object.objectsResearchFields.find(
            (f, index) => (f.id || `field-${index}`) === fieldId,
        );

        if (!originalField) return;

        // Compare with original value - for vocabulary fields, compare with vocabulary_id
        const originalValue =
            originalField.vocabulary_id || originalField.value || "";

        if (value !== originalValue) {
            // Track this as a change
            editedFields[fieldId] = value;
        } else {
            // If it matches the original, remove from edited fields
            delete editedFields[fieldId];
            editedFields = { ...editedFields }; // Trigger reactivity
        }
    }

    // Get the research field definition from the context
    function getResearchFieldDef(fieldId) {
        if (!object?.objectsResearchFields) return null;

        const objField = object.objectsResearchFields.find(
            (f) => f.field_id === fieldId,
        );
        if (!objField) return null;

        return researchFields.find((rf) => rf.id === objField.field_id);
    }

    // Get field type safely with fallbacks
    function getFieldType(field) {
        return field?.researchField?.type?.toLowerCase() || "free_text";
    }

    // Get options for select/multiselect fields in a format select can use
    function getFieldOptions(field) {
        // Get field definition by field_id
        const fieldDef = researchFields.find(
            (rf) => rf.id === field.researchField?.id,
        );

        if (!fieldDef?.vocabularies?.length) {
            return [];
        }

        // Format the vocabularies to work with HTML select
        return fieldDef.vocabularies.map((vocab) => ({
            id: vocab.id,
            label: vocab.option?.content || "Unnamed option",
        }));
    }

    // Helper to determine if field should use a select
    function shouldUseSelect(field) {
        // First check field type
        const fieldType = getFieldType(field);
        return fieldType === "vocabulary" || fieldType === "multiselect";
    }

    // Function to get object title from mapped ontology field
    function getObjectTitle(currentObject) {
        if (currentObject?.objectsOntologyFields) {
            const titleField = currentObject.objectsOntologyFields.find(
                (field) =>
                    field.ontologyField?.name?.content?.toLowerCase() ===
                    "object id",
            );
            if (titleField && titleField.value) {
                return titleField.value;
            }
        }
        return currentObject?.id || "Unknown ID";
    }

    // Function to get object type (designation) from mapped ontology field
    function getObjectType(currentObject) {
        if (currentObject?.objectsOntologyFields) {
            const designationField = currentObject.objectsOntologyFields.find(
                (field) =>
                    field.ontologyField?.name?.content?.toLowerCase() ===
                    "designation",
            );
            return designationField?.value || null;
        }
        return null;
    }

    // Get object status
    function getObjectStatus(currentObject) {
        return currentObject?.status || "unknown status";
    }

    // Function to find image URL from the object's linked assets
    function getObjectImageUrl(currentObject) {
        if (
            !currentObject?.objectsAssets ||
            currentObject.objectsAssets.length === 0
        ) {
            return null;
        }

        const firstObjectAsset = currentObject.objectsAssets[0];
        if (!firstObjectAsset || !firstObjectAsset.asset) {
            return null;
        }

        const asset = firstObjectAsset.asset;
        let imageUrl = null;

        if (asset.formats) {
            try {
                const formats =
                    typeof asset.formats === "string"
                        ? JSON.parse(asset.formats)
                        : asset.formats;

                imageUrl = formats.md || formats.lg || formats.original || null;
            } catch (e) {
                console.error("Error parsing asset formats:", e);
                imageUrl = asset.path || null;
            }
        } else {
            imageUrl = asset.path || null;
        }

        return imageUrl ? `media://${imageUrl}` : null;
    }

    function handleDelete() {
        if (object?.id) {
            console.log("Delete object:", object.id);
            // alert(`Deletion for object ${object.id} not implemented yet.`); // Removed alert
        } else {
            console.error("Cannot delete: Object ID is missing.");
        }
    }

    // Handle save button click
    function handleSave() {
        if (!object?.id || !hasChanges()) return;

        const changes = [];

        // Collect all field changes
        for (const editedFieldKey in editedFields) {
            // Find the original field data
            const originalFieldData = object.objectsResearchFields.find(
                (f, index) => (f.id || `field-${index}`) === editedFieldKey,
            );

            if (originalFieldData?.id) {
                const editedValue = editedFields[editedFieldKey];

                // Check if this is a vocabulary field
                const isVocabularyField = shouldUseSelect(originalFieldData);

                if (isVocabularyField) {
                    // For vocabulary fields, save the ID as vocabularyId
                    // Only set value if it's not a vocabulary selection
                    changes.push({
                        id: originalFieldData.id,
                        value: editedValue ? null : originalFieldData.value,
                        vocabularyId: editedValue || null, // If empty, set to null
                    });
                } else {
                    // For regular fields, save as value
                    changes.push({
                        id: originalFieldData.id,
                        value: editedValue,
                        vocabularyId: null,
                    });
                }
            }
        }

        if (changes.length === 0) {
            console.error("No valid changes to save");
            return;
        }

        console.log("Saving changes:", changes);

        // Dispatch save event
        dispatch("save", {
            objectId: object.id,
            changes: changes,
        });

        // Clear edited fields after saving
        editedFields = {};
    }
</script>

{#if object}
    <div class="object-detail-container">
        <!-- Object Image (if available) -->
        {#if getObjectImageUrl(object)}
            <div class="mb-3 text-center">
                <BaseImage
                    src={getObjectImageUrl(object)}
                    alt={getObjectTitle(object)}
                    class="img-fluid rounded"
                    ratio="1x1"
                    objectFit="contain"
                    style="max-height: 300px;"
                />
            </div>
        {/if}

        <!-- Object Details -->
        <div class="object-details-grid px-2">
            <div class="object-detail-row">
                <div class="object-detail-label">ID</div>
                <div class="object-detail-value">{object.id || "N/A"}</div>
            </div>

            <div class="object-detail-row">
                <div class="object-detail-label">Object ID</div>
                <div class="object-detail-value">{getObjectTitle(object)}</div>
            </div>

            {#if getObjectType(object)}
                <div class="object-detail-row">
                    <div class="object-detail-label">Designation</div>
                    <div class="object-detail-value">
                        {getObjectType(object)}
                    </div>
                </div>
            {/if}

            <div class="object-detail-row">
                <div class="object-detail-label">Status</div>
                <div class="object-detail-value">
                    {#if getObjectStatus(object).toLowerCase() === "completed"}
                        <BaseBadge text="Completed" class="bg-success" />
                    {:else if getObjectStatus(object).toLowerCase() === "in progress"}
                        <BaseBadge
                            text="In progress"
                            class="bg-warning text-dark"
                        />
                    {:else}
                        <BaseBadge
                            text={getObjectStatus(object)}
                            class="bg-secondary"
                        />
                    {/if}
                </div>
            </div>

            <hr class="my-3" />

            <!-- Display all research fields as editable inputs -->
            <h6 class="mt-3 mb-2">Research Fields</h6>
            {#if object.objectsResearchFields && object.objectsResearchFields.length > 0}
                <div class="research-fields-form">
                    {#each [...object.objectsResearchFields].sort((a, b) => a.order - b.order) as field, index (field.id || `field-${index}`)}
                        <div class="field mb-3">
                            <label
                                for={field.id || `field-${index}`}
                                class="font-medium block mb-1"
                                >{field.researchField?.name?.content ||
                                    field.researchField?.name ||
                                    ""}</label
                            >

                            <!-- Use standard HTML select for vocabulary fields -->
                            {#if shouldUseSelect(field)}
                                {@const options = getFieldOptions(field)}
                                {#if options.length > 0}
                                    <select
                                        id={field.id || `field-${index}`}
                                        class="form-select w-full"
                                        value={fieldValues[
                                            field.id || `field-${index}`
                                        ] || ""}
                                        on:change={(e) =>
                                            handleInputChange(
                                                field.id || `field-${index}`,
                                                e.target.value,
                                            )}
                                    >
                                        <option value=""
                                            >-- Select option --</option
                                        >
                                        {#each options as option}
                                            <option value={option.id}
                                                >{option.label}</option
                                            >
                                        {/each}
                                    </select>
                                {:else}
                                    <!-- Fallback text input when options aren't available -->
                                    <BaseInput
                                        id={field.id || `field-${index}`}
                                        class="input w-full"
                                        value={fieldValues[
                                            field.id || `field-${index}`
                                        ] || ""}
                                        on:input={(e) =>
                                            handleInputChange(
                                                field.id || `field-${index}`,
                                                e.target.value,
                                            )}
                                        placeholder="Enter value..."
                                    />
                                    <!-- Show vocabulary information if a vocabulary is selected -->
                                    {#if field.vocabulary_id}
                                        <div class="text-xs text-blue-600 mt-1">
                                            Selected vocabulary: {field
                                                .vocabulary?.option?.content ||
                                                "Unknown option"}
                                        </div>
                                    {/if}
                                {/if}
                            {:else}
                                <BaseInput
                                    id={field.id || `field-${index}`}
                                    class="input w-full"
                                    value={fieldValues[
                                        field.id || `field-${index}`
                                    ] || ""}
                                    on:input={(e) =>
                                        handleInputChange(
                                            field.id || `field-${index}`,
                                            e.target.value,
                                        )}
                                    placeholder="Enter value..."
                                />
                            {/if}
                        </div>
                    {/each}
                </div>
            {:else}
                <p class="text-muted">No research fields available.</p>
            {/if}
        </div>

        <!-- Actions -->
        <div class="mt-4 d-flex justify-content-end gap-2">
            <BaseButton
                text="Save"
                icon="save"
                class="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={!hasChanges()}
            />
            <BaseButton
                text="Delete"
                icon="trash"
                class="btn btn-danger btn-sm"
                onClick={handleDelete}
            />
        </div>
    </div>
{:else}
    <p>No object selected or object data is missing.</p>
{/if}

<style>
    .object-detail-container {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .object-details-grid {
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }

    .object-detail-row {
        margin-bottom: 0.75rem;
    }

    .object-detail-label {
        font-weight: bold;
        display: block;
        margin-bottom: 0.1rem;
    }

    .object-detail-value {
        word-break: break-word;
    }

    .research-fields-form {
        max-height: 400px;
        overflow-y: auto;
        padding-right: 5px;
    }
</style>
