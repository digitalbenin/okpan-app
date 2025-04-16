<script>
    import { getContext } from "svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";

    // Get data from context
    const objects = getContext("objects") || [];
    // const assets = getContext("assets") || []; // No longer needed here

    // Function to get object title from mapped ontology field
    function getObjectTitle(object) {
        if (object.objectsOntologyFields) {
            const titleField = object.objectsOntologyFields.find(
                (field) =>
                    field.ontologyField?.name?.content?.toLowerCase() ===
                    "object id",
            );
            if (titleField && titleField.value) {
                return titleField.value;
            }
        }
        // Fallback to the object's ID if no mapped field is found or value is empty
        return object.id || "Unknown ID";
    }

    // Function to get object type (designation) from mapped ontology field
    function getObjectType(object) {
        if (object.objectsOntologyFields) {
            const designationField = object.objectsOntologyFields.find(
                (field) =>
                    field.ontologyField?.name?.content?.toLowerCase() ===
                    "designation",
            );
            // Return the value if found, otherwise null
            return designationField?.value || null;
        }
        return null; // Return null if objectsOntologyFields doesn't exist
    }

    // Placeholder function to get object status
    function getObjectStatus(object) {
        // Use the status field directly from the object data
        return object.status || "unknown status";
    }

    // Function to find image URL from the object's linked assets
    function getObjectImageUrl(object) {
        if (!object.objectsAssets || object.objectsAssets.length === 0) {
            return null; // No linked assets
        }

        const firstObjectAsset = object.objectsAssets[0];
        if (!firstObjectAsset || !firstObjectAsset.asset) {
            return null; // Malformed object asset link
        }

        const asset = firstObjectAsset.asset;
        let imageUrl = null;

        if (asset.formats) {
            try {
                // Parse formats if it's a string (safer check)
                const formats =
                    typeof asset.formats === "string"
                        ? JSON.parse(asset.formats)
                        : asset.formats;

                // Prefer thumbnail or small format for the card view
                imageUrl =
                    formats.thumbnail || formats.sm || formats.original || null;
            } catch (e) {
                console.error("Error parsing asset formats:", e);
                // Fallback to path if formats parsing fails
                imageUrl = asset.path || null;
            }
        } else {
            // Fallback to path if formats field doesn't exist
            imageUrl = asset.path || null;
        }

        // Prefix with media protocol if a URL/path was found
        return imageUrl ? `media://${imageUrl}` : null;
    }

    // Placeholder for status filter
    let statusFilter = $state("all"); // 'all', 'completed', 'in progress'

    // Placeholder for display mode
    let displayMode = $state("grid"); // 'grid' or 'list'

    // Computed property for filtered objects (implement actual filtering later)
    let filteredObjects = $derived(objects); // TODO: Add filtering logic
</script>

<div class="container-fluid">
    <!-- Control Row 1: Display, Search, Actions -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-2">
            <span class="me-2">Display as:</span>
            <div class="btn-group" role="group" aria-label="Display mode">
                <BaseButton
                    icon="grid-3x3-gap-fill"
                    class="btn btn-sm {displayMode === 'grid'
                        ? 'btn-primary'
                        : 'btn-outline-secondary'}"
                    onClick={() => (displayMode = "grid")}
                />
                <BaseButton
                    icon="list-ul"
                    class="btn btn-sm {displayMode === 'list'
                        ? 'btn-primary'
                        : 'btn-outline-secondary'}"
                    onClick={() => (displayMode = "list")}
                />
            </div>
        </div>
        <div class="d-flex align-items-center gap-2">
            <!-- Search Input REMOVED -->

            <!-- Action Buttons -->
            <BaseButton
                text="Add new object"
                icon="plus-lg"
                class="btn btn-sm btn-primary"
                onClick={() => {
                    /* TODO: Implement add action */
                }}
            />
            <BaseButton
                text="Import data"
                icon="upload"
                class="btn btn-sm btn-primary"
                onClick={() => {
                    /* TODO: Implement import action */
                }}
            />
        </div>
    </div>

    <!-- Control Row 2: Filter -->
    <div class="mb-4">
        <BaseButton
            text="Filter by status"
            icon="filter"
            iconPosition="right"
            class="btn btn-sm btn-dark"
            onClick={() => {
                /* TODO: Implement filter action */
            }}
        />
        <!-- TODO: Add dropdown/modal for filtering -->
    </div>

    <!-- Grid/List Content -->
    {#if displayMode === "grid"}
        <div
            class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4"
        >
            {#each filteredObjects as object (object.id)}
                <div class="col">
                    <div class="card h-100">
                        <BaseImage
                            src={getObjectImageUrl(object)}
                            alt={getObjectTitle(object)}
                            ratio="1/1"
                            objectFit="cover"
                            class="card-img-top"
                        />
                        <div class="card-body">
                            <h6 class="card-title text-truncate">
                                {getObjectTitle(object)}
                            </h6>
                            {#if getObjectType(object)}
                                <p class="card-text small text-muted mb-1">
                                    {getObjectType(object)}
                                </p>
                            {/if}
                            <!-- Status Badge -->
                            {#if getObjectStatus(object).toLowerCase() === "completed"}
                                <span class="badge bg-success">Completed</span>
                            {:else if getObjectStatus(object).toLowerCase() === "in progress"}
                                <span class="badge bg-warning text-dark"
                                    >in progress</span
                                >
                            {:else}
                                <span class="badge bg-secondary"
                                    >{getObjectStatus(object)}</span
                                >
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
        </div>
    {:else}
        <!-- TODO: Implement List View -->
        <div class="alert alert-secondary">List view not implemented yet.</div>
    {/if}

    {#if filteredObjects.length === 0}
        <div class="alert alert-info mt-4">
            No objects found.
            <!-- TODO: Add guidance or link to add/import -->
        </div>
    {/if}
</div>
