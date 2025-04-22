<script>
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";

    let { object } = $props();

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
            alert(`Deletion for object ${object.id} not implemented yet.`);
        } else {
            console.error("Cannot delete: Object ID is missing.");
        }
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

            <!-- Display all ontology fields -->
            <h6 class="mt-3 mb-2">Research Fields</h6>
            {#if object.objectsOntologyFields && object.objectsOntologyFields.length > 0}
                {#each object.objectsOntologyFields as field}
                    {#if field.ontologyField?.name?.content && field.value}
                        <div class="object-detail-row">
                            <div class="object-detail-label">
                                {field.ontologyField.name.content}
                            </div>
                            <div class="object-detail-value">{field.value}</div>
                        </div>
                    {/if}
                {/each}
            {:else}
                <p class="text-muted">No research fields available.</p>
            {/if}
        </div>

        <!-- Actions -->
        <div class="mt-4 d-flex justify-content-end gap-2">
            <BaseButton
                text="Edit"
                icon="pencil"
                class="btn btn-primary btn-sm"
                onClick={() => {
                    /* TODO: Implement edit functionality */
                }}
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
</style>
