<script>
    import { getContext } from "svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";

    // Get assets from context
    const assets = getContext("assets") || [];
    const objects = getContext("objects") || [];
    const institution = getContext("institution");
    const projectId = getContext("projectId");
    const institutionId = getContext("institutionId");

    // Display mode state
    let displayMode = "grid"; // 'grid' or 'list'

    // Function to determine if an asset is linked to objects
    function isAssetLinked(asset) {
        // Check if the asset has any objectsAssets relations
        // If it has at least one, it's linked to an object
        return asset.objectsAssets && asset.objectsAssets.length > 0;
    }

    // Format date for display
    function formatDate(dateString) {
        if (!dateString) return "N/A";
        const date = new Date(parseInt(dateString));
        return date.toLocaleDateString();
    }

    // Get appropriate image format based on display context
    function getImageSrc(asset) {
        if (!asset || !asset.formats) return null;

        try {
            // Parse formats if it's a string
            const formats =
                typeof asset.formats === "string"
                    ? JSON.parse(asset.formats)
                    : asset.formats;

            // For grid view use medium size, for list view use small size
            if (displayMode === "grid") {
                return formats.md || formats.original;
            } else {
                return formats.sm || formats.original;
            }
        } catch (e) {
            console.error("Error parsing formats:", e);
            return asset.path || null;
        }
    }
</script>

<div class="container-fluid mt-4">
    <!-- Display Controls -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div>
            <span class="me-2">Display as:</span>
            <div class="btn-group" role="group">
                <button
                    type="button"
                    class="btn btn-sm {displayMode === 'grid'
                        ? 'btn-primary'
                        : 'btn-outline-secondary'}"
                    on:click={() => (displayMode = "grid")}
                >
                    <i class="bi bi-grid-3x3-gap-fill"></i>
                </button>
                <button
                    type="button"
                    class="btn btn-sm {displayMode === 'list'
                        ? 'btn-primary'
                        : 'btn-outline-secondary'}"
                    on:click={() => (displayMode = "list")}
                >
                    <i class="bi bi-list-ul"></i>
                </button>
            </div>
        </div>

        <div class="d-flex">
            <div class="dropdown me-2">
                <button
                    class="btn btn-sm btn-dark dropdown-toggle"
                    type="button"
                    id="sortDropdown"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                >
                    <i class="bi bi-sort-down-alt me-1"></i> Filename
                </button>
                <ul class="dropdown-menu" aria-labelledby="sortDropdown">
                    <li><a class="dropdown-item" href="#">Filename</a></li>
                    <li><a class="dropdown-item" href="#">Date</a></li>
                    <li><a class="dropdown-item" href="#">Type</a></li>
                </ul>
            </div>

            <div class="dropdown me-2">
                <button
                    class="btn btn-sm btn-dark dropdown-toggle"
                    type="button"
                    id="filterDropdown"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                >
                    <i class="bi bi-funnel me-1"></i> Filter by status
                </button>
                <ul class="dropdown-menu" aria-labelledby="filterDropdown">
                    <li><a class="dropdown-item" href="#">All</a></li>
                    <li><a class="dropdown-item" href="#">Linked</a></li>
                    <li><a class="dropdown-item" href="#">Not linked</a></li>
                </ul>
            </div>

            <button class="btn btn-sm btn-primary">
                <i class="bi bi-upload me-1"></i> Import assets
            </button>
        </div>
    </div>

    <!-- Assets Grid -->
    {#if displayMode === "grid"}
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-5 g-3">
            {#if assets.length === 0}
                <div class="col-12 text-center py-5">
                    <p class="text-muted">
                        No assets found for this institution.
                    </p>
                    <button class="btn btn-primary mt-2">
                        <i class="bi bi-upload me-1"></i> Import assets
                    </button>
                </div>
            {:else}
                {#each assets as asset, i}
                    <div class="col">
                        <div class="card h-100 border-light">
                            <div
                                class="card-img-top position-relative"
                                style="height: 200px; overflow: hidden;"
                            >
                                <BaseImage
                                    src={getImageSrc(asset)
                                        ? `media://${getImageSrc(asset)}`
                                        : asset.path
                                          ? `media://${asset.path}`
                                          : null}
                                    alt={asset.filename || `Asset ${i + 1}`}
                                    ratio="1"
                                    objectFit="cover"
                                    class="w-100 h-100"
                                />
                            </div>
                            <div class="card-body p-2">
                                <p class="card-text mb-1 text-truncate">
                                    {asset.filename || `asset_${i + 1}.jpg`}
                                </p>
                                <div>
                                    {#if isAssetLinked(asset)}
                                        <BaseBadge
                                            text="Linked"
                                            class="bg-success"
                                        />
                                    {:else}
                                        <BaseBadge
                                            text="Not linked"
                                            class="bg-warning text-dark"
                                        />
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {:else}
        <!-- List View -->
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Preview</th>
                        <th>Filename</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {#if assets.length === 0}
                        <tr>
                            <td colspan="5" class="text-center py-4">
                                <p class="text-muted">
                                    No assets found for this institution.
                                </p>
                                <button class="btn btn-primary mt-2">
                                    <i class="bi bi-upload me-1"></i> Import assets
                                </button>
                            </td>
                        </tr>
                    {:else}
                        {#each assets as asset, i}
                            <tr>
                                <td style="width: 80px; height: 60px;">
                                    <BaseImage
                                        src={getImageSrc(asset)
                                            ? `media://${getImageSrc(asset)}`
                                            : asset.path
                                              ? `media://${asset.path}`
                                              : null}
                                        alt={asset.filename || `Asset ${i + 1}`}
                                        width="60"
                                        height="60"
                                        objectFit="cover"
                                    />
                                </td>
                                <td>{asset.filename || `asset_${i + 1}.jpg`}</td
                                >
                                <td>{formatDate(asset.created_at)}</td>
                                <td>{asset.type || "image/jpeg"}</td>
                                <td>
                                    {#if isAssetLinked(asset)}
                                        <BaseBadge
                                            text="Linked"
                                            class="bg-success"
                                        />
                                    {:else}
                                        <BaseBadge
                                            text="Not linked"
                                            class="bg-warning text-dark"
                                        />
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        </div>
    {/if}
</div>
