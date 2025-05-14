<script>
  import { getContext } from "svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseToggle from "$lib/components/base/BaseToggle.svelte";
  import BaseSelect from "$lib/components/base/BaseSelect.svelte";

  let {
    object,
    onDelete = null,
    onSave = null,
    onUnlinkAssetRequest = (details) => {
      console.warn(
        "ObjectDetail: onUnlinkAssetRequest prop not provided.",
        details,
      );
    },
  } = $props();
  const researchFields = getContext("researchFields") || [];

  // State management
  let editedFields = $state({});
  let fieldValues = $state({});
  let statusValue = $state(false);
  let originalStatus = $state("");
  let statusChanged = $state(false);
  let selectedImage = $state(object.objectsAssets[0]);
  $inspect(selectedImage);

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

      // Initialize or update selectedImage if object or its assets change
      // This ensures selectedImage is up-to-date if the object prop itself changes.
      if (object.objectsAssets && object.objectsAssets.length > 0) {
        const currentSelectedIsValid =
          selectedImage &&
          object.objectsAssets.some((a) => a.id === selectedImage.id);
        if (!currentSelectedIsValid) {
          selectedImage = object.objectsAssets[0];
        }
      } else {
        selectedImage = null;
      }
    } else {
      fieldValues = {};
      editedFields = {};
      statusChanged = false;
      // Reset selectedImage if object becomes invalid or has no assets
      if (
        !object ||
        !object.objectsAssets ||
        object.objectsAssets.length === 0
      ) {
        selectedImage = null;
      }
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
          field.ontologyField?.name?.content?.toLowerCase() === "object id",
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
          field.ontologyField?.name?.content?.toLowerCase() === "designation",
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
          vocabularyId: isVocabularyField ? editedValue || null : null,
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
      console.error("Save handler (onSave prop) not provided to ObjectDetail.");
    }

    // Clear edited fields after saving
    editedFields = {};
    statusChanged = false;
  }

  // --- Asset Unlinking Functions - Modified ---
  function requestAssetUnlink(assetLinkEntry) {
    if (object?.id && assetLinkEntry?.asset?.id) {
      const unlinkDetails = {
        objectId: object.id,
        assetId: assetLinkEntry.asset.id,
        assetFilename: assetLinkEntry.asset.filename || "this asset",
      };
      onUnlinkAssetRequest(unlinkDetails); // Call the prop function
    } else {
      console.error(
        "Cannot initiate unlink: missing object ID or asset ID from selected image.",
        object,
        assetLinkEntry,
      );
    }
  }
  // --- End Asset Unlinking Functions ---
</script>

{#if object}
  <div class="position-relative d-flex flex-column h-100">
    <!-- Object Image -->
    <div class="d-flex bg-light align-items-start">
      <div class="text-center p-3 col-6">
        {#if selectedImage && selectedImage.asset}
          <BaseImage
            src="media://{selectedImage.asset.path}"
            alt={selectedImage.asset.filename || selectedImage.id}
            class="img-fluid rounded"
            objectFit="contain"
            style="max-height: 300px;"
          />
          <div class="mt-2">
            <BaseButton
              text="Unlink from this Object"
              class="btn btn-link text-danger btn-sm p-0"
              onClick={() => requestAssetUnlink(selectedImage)}
              title="Unlink this asset from the current object"
            />
          </div>
        {:else if object.objectsAssets && object.objectsAssets.length > 0}
          <p class="text-muted p-5">Select an image thumbnail to view.</p>
        {:else}
          <p class="text-muted p-5">No assets linked to this object.</p>
        {/if}
      </div>

      {#if object.objectsAssets && object.objectsAssets.length > 1}
        <div
          class="d-flex flex-wrap gap-2 overflow-y-auto mt-3"
          style="max-height: 300px;"
        >
          {#each object.objectsAssets as asset}
            <div
              role="button"
              tabindex="0"
              onkeydown={() => {}}
              onclick={() => (selectedImage = asset)}
              class:border={asset.id === selectedImage.id}
              class="rounded overflow-hidden border-dark p-1"
            >
              <img
                src="media://{asset.asset.path}"
                alt={asset.id}
                width="60"
                height="60"
                class="object-fit-contain"
              />
            </div>
          {/each}
        </div>
      {/if}
      <div class="ms-auto p-2 mt-3 me-2 rounded bg-secondary">
        <button class="btn btn-outline-light btn-sm border-0" aria-label="add">
          <i class="bi bi-plus"></i></button
        >
      </div>
    </div>
    <!-- Scrollable Content -->
    <div class="flex-grow-1 overflow-y-auto px-3 py-2 border-top">
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
                    {@const fieldId = field.id || `field-${index}`}
                    <BaseSelect
                      id={fieldId}
                      {options}
                      valueId={fieldValues[fieldId] || ""}
                      idKey="id"
                      labelKey="label"
                      placeholder="-- Select option --"
                      onChange={(e) => {
                        fieldValues[fieldId] = e.target.value;
                        handleInputChange(fieldId, e.target.value);
                      }}
                    />
                  {:else}
                    <BaseInput
                      id={field.id || `field-${index}`}
                      class="input w-full"
                      value={fieldValues[field.id || `field-${index}`] || ""}
                      onInput={(e) => {
                        fieldValues[field.id || `field-${index}`] =
                          e.target.value;
                        handleInputChange(
                          field.id || `field-${index}`,
                          e.target.value,
                        );
                      }}
                      placeholder="Enter value..."
                    />
                    {#if field.vocabulary_id}
                      <div class="text-xs text-blue-600 mt-1">
                        Selected vocabulary: {field.vocabulary?.option
                          ?.content || "Unknown option"}
                      </div>
                    {/if}
                  {/if}
                {:else}
                  <BaseInput
                    id={field.id || `field-${index}`}
                    class="input w-full"
                    value={fieldValues[field.id || `field-${index}`] || ""}
                    onInput={(e) => {
                      fieldValues[field.id || `field-${index}`] =
                        e.target.value;
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
              <div class="col-3 text-break">Institution Field</div>
              <div class="col-5 text-break">Value</div>
            </div>
            <!-- Data Rows -->
            {#each object.objectsOntologyFields as ontologyField (ontologyField.id)}
              <div class="d-flex border-bottom py-1 px-1">
                <div
                  class="col-4 text-break"
                  title={ontologyField.ontologyField?.description?.content ||
                    "No description"}
                >
                  <span class="badge bg-secondary">
                    {ontologyField.ontologyField?.name?.content || "N/A"}
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

      <!-- Actions - Fixed at bottom -->
    </div>
    <div class="bg-light p-2 border-top">
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
{/if}

<style>
  /* .object-detail-value {
    word-break: break-word;
  } */
</style>
