<script>
    import { createEventDispatcher } from "svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseSelect from "$lib/components/base/BaseSelect.svelte";

    let { object } = $props();

    const dispatch = createEventDispatcher();

    // Create a simple map to track field changes
    let editedFields = $state({});

    // Track field values for each research field
    let fieldValues = $state({});

    // Keep a reference to the previous field values to avoid circular updates
    let previousFieldValues = $state({});

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
                values[fieldId] = field.value || "";
            });
            fieldValues = values;
            previousFieldValues = { ...values };
            console.log("Field values initialized:", values);

            // Debug log for field structure
            if (object.objectsResearchFields[0]) {
                console.log(
                    "First research field structure:",
                    JSON.stringify(object.objectsResearchFields[0], null, 2),
                );
            }
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

    // Update edited fields when a field value changes
    function fieldValueChanged(fieldId, newValue) {
        if (!object?.objectsResearchFields) {
            console.warn(
                "Cannot change field value: No research fields available",
            );
            return;
        }

        // Find the original field by either id or the generated field-index ID
        const isGeneratedId = fieldId.startsWith("field-");

        const originalField = object.objectsResearchFields.find((f, index) => {
            if (isGeneratedId && !f.id) {
                return `field-${index}` === fieldId;
            }
            return f.id === fieldId;
        });

        if (originalField) {
            const originalValue = originalField.value || "";

            if (newValue !== originalValue) {
                // Track this as a change
                editedFields[fieldId] = newValue;
            } else {
                // Remove from edited fields if value is back to original
                const newEditedFields = { ...editedFields };
                delete newEditedFields[fieldId];
                editedFields = newEditedFields;
            }
        }
    }

    // A more controlled effect to watch field value changes
    $effect(() => {
        // Only run if we have field values to watch
        if (Object.keys(fieldValues).length === 0) return;

        // Compare current values with previous values
        const fieldIds = Object.keys(fieldValues);
        for (const fieldId of fieldIds) {
            const currentValue = fieldValues[fieldId];
            const prevValue = previousFieldValues[fieldId];

            if (currentValue !== prevValue) {
                fieldValueChanged(fieldId, currentValue);
                // Update previous value to prevent loops
                previousFieldValues[fieldId] = currentValue;
            }
        }
    });

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

        // Collect all field changes, ensuring we use the correct ID
        for (const editedFieldKey in editedFields) {
            // Find the original field data based on the key used in editedFields
            // This key could be the actual ID or the generated field-${index}
            const isGeneratedKey = editedFieldKey.startsWith("field-");
            const originalFieldData = object.objectsResearchFields.find(
                (f, index) => {
                    if (isGeneratedKey && !f.id) {
                        // Match based on index if the key is generated and the field has no ID
                        return `field-${index}` === editedFieldKey;
                    }
                    // Otherwise, match based on the actual field ID
                    return f.id === editedFieldKey;
                },
            );

            if (originalFieldData && originalFieldData.id) {
                // We found the corresponding field and it has a database ID
                changes.push({
                    id: originalFieldData.id, // Use the ACTUAL database ID
                    value: editedFields[editedFieldKey],
                });
            } else {
                // Log an error if we can't find the original field or it lacks an ID
                // This shouldn't happen if initialization is correct, but good for safety
                console.error(
                    `Could not find original field data or ID for key: ${editedFieldKey}. Cannot save this change.`,
                    originalFieldData,
                );
            }
        }

        if (changes.length === 0 && Object.keys(editedFields).length > 0) {
            console.error(
                "Attempted to save, but no valid changes could be constructed.",
            );
            // Optionally, show a user-facing error here
            return; // Don't dispatch if no valid changes were found
        }

        // Dispatch save event with correctly structured changes
        dispatch("save", {
            objectId: object.id,
            changes: changes,
        });

        // Clear edited fields after dispatching save
        editedFields = {};
    }

    // Function to handle field value changes
    async function handleFieldChange(fieldId, value) {
        if (!fieldId) {
            console.error("Field ID is undefined");
            return;
        }

        // First update the fieldValues reactively
        fieldValues[fieldId] = value;
        fieldValues = fieldValues; // Trigger reactivity

        // Find the original field to compare with
        const originalField = object.objectsResearchFields.find(
            (f) => (f.id || "") === fieldId,
        );
        if (!originalField) {
            console.error(`Could not find field with ID ${fieldId}`);
            return;
        }

        // Check if the value has changed from the original
        if (value !== (originalField.value || "")) {
            editedFields[fieldId] = value;
        } else {
            // If it matches the original value, remove it from edited fields
            delete editedFields[fieldId];
        }
        editedFields = editedFields; // Trigger reactivity
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
                        <div class="field mb-2">
                            <label
                                for={field.id || `field-${index}`}
                                class="font-medium block mb-1"
                                >{field.researchField?.name?.content ||
                                    field.researchField?.name ||
                                    ""}</label
                            >

                            <BaseInput
                                id={field.id || `field-${index}`}
                                class="input w-full"
                                bind:value={
                                    fieldValues[field.id || `field-${index}`]
                                }
                            />
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
