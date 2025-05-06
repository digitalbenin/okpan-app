<script>
    import { createEventDispatcher, getContext } from "svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseToggle from "$lib/components/base/BaseToggle.svelte";
    import BaseSelect from "$lib/components/base/BaseSelect.svelte";

    let { object, onDelete = null, onSave = null } = $props();
    const researchFields = getContext("researchFields") || [];
    //const dispatch = createEventDispatcher();

    // State management
    let editedFields = $state({});
    let fieldValues = $state({});
    let statusValue = $state(false);
    let originalStatus = $state("");
    let statusChanged = $state(false);

    // Initialize when object changes
    $effect(() => {
        if (
            object &&
            object.objectsResearchFields &&
            object.objectsResearchFields.length > 0
        ) {
            editedFields = {};
            statusChanged = false;

            const values = {};
            object.objectsResearchFields.forEach((field, index) => {
                const fieldId = field.id || `field-${index}`;
                values[fieldId] = field.vocabulary_id || field.value || "";
            });

            // Set status toggle
            originalStatus = getObjectStatus(object).toLowerCase();
            statusValue = originalStatus === "completed";

            fieldValues = values;
        } else {
            fieldValues = {};
            editedFields = {};
            statusChanged = false;
        }
    });

    // Check if any fields have changed
    function hasChanges() {
        return Object.keys(editedFields).length > 0 || statusChanged;
    }

    // Handle status toggle change
    function handleStatusChange(event) {
        const newCompleted = event.target.checked;
        statusValue = newCompleted;
        statusChanged = newCompleted
            ? originalStatus !== "completed"
            : originalStatus === "completed";
    }

    // Handle input field changes
    function handleInputChange(fieldId, value) {
        if (!fieldId) return;

        const originalField = object.objectsResearchFields.find(
            (f, index) => (f.id || `field-${index}`) === fieldId,
        );

        if (!originalField) return;

        const isVocabularyField = shouldUseSelect(originalField);
        const originalValue = isVocabularyField
            ? originalField.vocabulary_id || ""
            : originalField.value || "";

        if (value !== originalValue) {
            editedFields[fieldId] = value;
        } else {
            delete editedFields[fieldId];
            editedFields = { ...editedFields }; // Trigger reactivity
        }
    }

    // Helper to determine field type
    function getFieldType(field) {
        return field?.researchField?.type?.toLowerCase() || "free_text";
    }

    // Get options for select fields
    function getFieldOptions(field) {
        const fieldDef = researchFields.find(
            (rf) => rf.id === field.researchField?.id,
        );

        if (!fieldDef?.vocabularies?.length) return [];

        return fieldDef.vocabularies.map((vocab) => ({
            id: vocab.id,
            label: vocab.option?.content || "Unnamed option",
        }));
    }

    // Check if field should use select
    function shouldUseSelect(field) {
        const fieldType = getFieldType(field);
        return fieldType === "vocabulary" || fieldType === "multiselect";
    }

    // Get object title
    function getObjectTitle(currentObject) {
        if (currentObject?.objectsOntologyFields) {
            const titleField = currentObject.objectsOntologyFields.find(
                (field) =>
                    field.ontologyField?.name?.content?.toLowerCase() ===
                    "object id",
            );
            if (titleField?.value) return titleField.value;
        }
        return currentObject?.id || "Unknown ID";
    }

    // Get object type
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

    // Get object image URL
    function getObjectImageUrl(currentObject) {
        if (!currentObject?.objectsAssets?.length) return null;

        const firstObjectAsset = currentObject.objectsAssets[0];
        if (!firstObjectAsset?.asset) return null;

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
                imageUrl = asset.path || null;
            }
        } else {
            imageUrl = asset.path || null;
        }

        return imageUrl ? `media://${imageUrl}` : null;
    }

    function handleDelete() {
        if (object?.id) {
            if (onDelete) {
                onDelete(object.id);
            } else {
                console.error("Delete handler not provided to ObjectDetail.");
            }
        }
    }

    // Handle save button click
    function handleSave() {
        if (!object?.id || !hasChanges()) return;

        const changes = [];

        // Collect field changes
        for (const editedFieldKey in editedFields) {
            const originalFieldData = object.objectsResearchFields.find(
                (f, index) => (f.id || `field-${index}`) === editedFieldKey,
            );

            if (originalFieldData?.id) {
                const editedValue = editedFields[editedFieldKey];
                const isVocabularyField = shouldUseSelect(originalFieldData);

                changes.push({
                    id: originalFieldData.id,
                    value: isVocabularyField ? null : editedValue,
                    vocabularyId: isVocabularyField
                        ? editedValue || null
                        : null,
                });
            }
        }

        // Prepare event data
        const saveData = {
            objectId: object.id,
            changes: changes,
        };

        // Add status change if modified
        if (statusChanged) {
            saveData.statusChange = statusValue ? "completed" : "in progress";
        }

        // Call the onSave handler passed from the parent
        if (onSave) {
            onSave(saveData);
        } else {
            console.error(
                "Save handler (onSave prop) not provided to ObjectDetail.",
            );
        }

        // Clear edited fields after saving
        editedFields = {};
        statusChanged = false;
    }
</script>

{#if object}
    <div class="position-relative d-flex flex-column h-100">
        <!-- Object Image -->
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

        <!-- Scrollable Content -->
        <div class="flex-grow-1 overflow-y-auto" style="padding-bottom: 50px;">
            <div class="fs-6">
                <h4 class="mt-3 mb-2">Research Fields</h4>
                {#if object.objectsResearchFields && object.objectsResearchFields.length > 0}
                    <div class="pe-1">
                        {#each [...object.objectsResearchFields].sort((a, b) => a.order - b.order) as field, index (field.id || `field-${index}`)}
                            <div class="field mb-3">
                                <label
                                    for={field.id || `field-${index}`}
                                    class="field-label d-block mb-1"
                                    >{field.researchField?.name?.content ||
                                        field.researchField?.name ||
                                        ""}</label
                                >

                                {#if shouldUseSelect(field)}
                                    {@const options = getFieldOptions(field)}
                                    {#if options.length > 0}
                                        {@const fieldId =
                                            field.id || `field-${index}`}
                                        <BaseSelect
                                            id={fieldId}
                                            {options}
                                            valueId={fieldValues[fieldId] || ""}
                                            idKey="id"
                                            labelKey="label"
                                            placeholder="-- Select option --"
                                            onChange={(e) => {
                                                fieldValues[fieldId] =
                                                    e.target.value;
                                                handleInputChange(
                                                    fieldId,
                                                    e.target.value,
                                                );
                                            }}
                                        />
                                    {:else}
                                        <BaseInput
                                            id={field.id || `field-${index}`}
                                            class="input w-full"
                                            value={fieldValues[
                                                field.id || `field-${index}`
                                            ] || ""}
                                            onInput={(e) => {
                                                fieldValues[
                                                    field.id || `field-${index}`
                                                ] = e.target.value;
                                                handleInputChange(
                                                    field.id ||
                                                        `field-${index}`,
                                                    e.target.value,
                                                );
                                            }}
                                            placeholder="Enter value..."
                                        />
                                        {#if field.vocabulary_id}
                                            <div
                                                class="text-xs text-blue-600 mt-1"
                                            >
                                                Selected vocabulary: {field
                                                    .vocabulary?.option
                                                    ?.content ||
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
                                        onInput={(e) => {
                                            fieldValues[
                                                field.id || `field-${index}`
                                            ] = e.target.value;
                                            handleInputChange(
                                                field.id || `field-${index}`,
                                                e.target.value,
                                            );
                                        }}
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

            <!-- Institution Data Section -->
            <div class="mt-4">
                <h4 class="mb-2">Institution Data</h4>
                {#if object.objectsOntologyFields && object.objectsOntologyFields.length > 0}
                    <div class="d-flex flex-column gap-1">
                        <!-- Header Row -->
                        <div
                            class="d-flex fw-bold bg-light border-bottom border-2 py-2 px-1"
                        >
                            <div class="col-4 text-break">Linked Field</div>
                            <div class="col-3 text-break">
                                Institution Field
                            </div>
                            <div class="col-5 text-break">Value</div>
                        </div>
                        <!-- Data Rows -->
                        {#each object.objectsOntologyFields as ontologyField (ontologyField.id)}
                            <div class="d-flex border-bottom py-1 px-1">
                                <div
                                    class="col-4 text-break"
                                    title={ontologyField.ontologyField
                                        ?.description?.content ||
                                        "No description"}
                                >
                                    <span class="badge bg-secondary">
                                        {ontologyField.ontologyField?.name
                                            ?.content || "N/A"}
                                    </span>
                                </div>
                                <div class="col-3 text-break">
                                    {ontologyField.label || "N/A"}
                                </div>
                                <div class="col-5 text-break">
                                    {ontologyField.value || "N/A"}
                                </div>
                            </div>
                        {/each}
                    </div>
                {:else}
                    <p class="text-muted">No institution data available.</p>
                {/if}
            </div>
        </div>

        <!-- Actions - Fixed at bottom -->
        <div
            class="position-absolute bottom-0 start-0 end-0 bg-white border-top z-3"
            style="padding-top: 0.125rem;"
        >
            <div class="d-flex justify-content-between align-items-center p-2">
                <div class="d-flex align-items-center">
                    <span class="me-2 pe-2">Mark as:</span>
                    <BaseToggle
                        value={statusValue}
                        label={statusValue ? "Completed" : "In progress"}
                        labelPosition="right"
                        onChange={handleStatusChange}
                    />
                </div>
                <div class="d-flex gap-2">
                    <BaseButton
                        text="Save"
                        icon="save"
                        class="btn btn-primary btn-sm"
                        disabled={!hasChanges()}
                        onClick={handleSave}
                    />
                    <BaseButton
                        text="Delete"
                        icon="trash"
                        class="btn btn-danger btn-sm"
                        onClick={handleDelete}
                    />
                </div>
            </div>
        </div>
    </div>
{:else}
    <p>No object selected or object data is missing.</p>
{/if}

<style>
    .object-detail-value {
        word-break: break-word;
    }
    .field-label {
        font-size: 0.7rem;
    }
</style>
