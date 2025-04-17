<script>
    import { getContext, onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import AssetDetail from "$lib/components/assets/assetDetail.svelte";
    import SidePanel from "$lib/components/common/SidePanel.svelte"; // Import the new SidePanel

    // Get assets from context
    const assets = getContext("assets") || [];

    // Display mode state
    let displayMode = "grid"; // 'grid' or 'list'

    // Selected asset state
    let selectedAssetId = null;
    let selectedAsset = null;
    let closeContentTimeout = null; // Added to manage timeout

    // Subscribe to URL changes
    let pageUnsubscribe;

    onMount(() => {
        pageUnsubscribe = page.subscribe((currentPage) => {
            const urlAssetId = currentPage.url.searchParams.get("assetId");

            // Convert null to undefined for comparison, or keep as string
            const currentSelectedId = selectedAssetId
                ? String(selectedAssetId)
                : undefined;
            const currentUrlId = urlAssetId ? String(urlAssetId) : undefined;

            if (currentUrlId && currentUrlId !== currentSelectedId) {
                // URL has an ID, and it's different from the current state, or state is null -> Open/switch panel
                console.log(
                    `URL change detected: Opening/switching to asset ${currentUrlId}`,
                );
                showAssetDetail(currentUrlId, false); // Don't push state if triggered by URL
            } else if (!currentUrlId && currentSelectedId) {
                // URL has no ID, but state does -> Close panel
                console.log(
                    `URL change detected: Closing asset ${currentSelectedId}`,
                );
                closeAssetDetail(false); // Don't push state if triggered by URL
            }
            // Handle case where URL and state match (no change needed)
            // Handle case where both are null/undefined (no change needed)
        });

        // Check initial URL state on mount
        const initialAssetId = $page.url.searchParams.get("assetId");
        if (initialAssetId) {
            console.log(
                `Initial mount: Found assetId ${initialAssetId} in URL`,
            );
            showAssetDetail(initialAssetId, false);
        }
    });

    onDestroy(() => {
        if (pageUnsubscribe) {
            pageUnsubscribe();
        }
        // Clear timeout on component destroy to prevent memory leaks
        if (closeContentTimeout) {
            clearTimeout(closeContentTimeout);
        }
    });

    // Function to find asset by ID
    function findAssetById(id) {
        // Assuming asset IDs are numbers or strings that need comparison
        return assets.find((asset) => String(asset.id) === String(id)) || null;
    }

    // Function to show asset detail panel
    function showAssetDetail(assetId, updateUrl = true) {
        // Clear any pending timeout to remove content, as we are now showing content
        if (closeContentTimeout) {
            clearTimeout(closeContentTimeout);
            closeContentTimeout = null;
        }

        const asset = findAssetById(assetId);
        const newAssetId = asset ? String(asset.id) : null;

        if (newAssetId && newAssetId !== selectedAssetId) {
            console.log(
                `Showing asset detail for ID: ${newAssetId}, updateUrl: ${updateUrl}`,
            );
            selectedAssetId = newAssetId;
            selectedAsset = asset;
            // The panel will open reactively based on selectedAssetId

            if (updateUrl) {
                const currentPath = $page.url.pathname;
                const currentParams = new URLSearchParams($page.url.search);
                currentParams.set("assetId", newAssetId);
                console.log(
                    `Updating URL: ${currentPath}?${currentParams.toString()}`,
                );
                goto(`${currentPath}?${currentParams.toString()}`, {
                    keepfocus: true,
                    noscroll: true,
                    replaceState: false, // Use false to allow back button navigation
                });
            }
        } else if (!newAssetId) {
            console.warn(`Asset with ID ${assetId} not found.`);
            closeAssetDetail(true); // Close if asset not found
        }
    }

    // Function to close asset detail panel
    function closeAssetDetail(updateUrl = true) {
        console.log(
            `Closing asset detail. Current ID: ${selectedAssetId}, updateUrl: ${updateUrl}`,
        );
        if (selectedAssetId !== null) {
            const idToRemove = selectedAssetId;
            selectedAssetId = null; // Start panel closing animation immediately
            // Panel closes reactively via isOpen={!!selectedAssetId}

            // Clear any existing timeout before setting a new one
            if (closeContentTimeout) {
                clearTimeout(closeContentTimeout);
            }

            // Set timeout to remove the content *after* the animation
            closeContentTimeout = setTimeout(() => {
                // Only set asset to null if the panel wasn't reopened for the same ID in the meantime
                // (selectedAssetId being null is the check that close is still intended)
                if (selectedAssetId === null) {
                    console.log(
                        `Timeout: Removing asset content for ID: ${idToRemove}`,
                    );
                    selectedAsset = null;
                }
                closeContentTimeout = null; // Clear the timeout ID variable
            }, 310); // Matches CSS transition duration + small buffer

            if (updateUrl) {
                const currentPath = $page.url.pathname;
                const currentParams = new URLSearchParams($page.url.search);
                currentParams.delete("assetId");
                const newSearch = currentParams.toString();
                const newUrl = `${currentPath}${newSearch ? "?" + newSearch : ""}`;
                console.log(`Updating URL: ${newUrl}`);
                goto(newUrl, {
                    keepfocus: true,
                    noscroll: true,
                    replaceState: false, // Use false to allow back button navigation
                });
            }
        }
    }

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

    // Keyboard handler for accessible clicks
    function handleAssetKeyPress(event, assetId) {
        if (event.key === "Enter" || event.key === " ") {
            showAssetDetail(assetId);
        }
    }
</script>

<div class="container-fluid mt-4">
    <!-- Control Row 1: Display, Actions -->
    <div class="d-flex justify-content-between align-items-center mb-3">
        <div class="d-flex align-items-center gap-2">
            <span class="me-2">Display as:</span>
            <div class="btn-group" role="group">
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
            <BaseButton
                text="Import assets"
                icon="upload"
                class="btn btn-sm btn-primary"
                onClick={() => {
                    /* TODO: Implement import */
                }}
            />
        </div>
    </div>

    <!-- Control Row 2: Sort, Filter -->
    <div class="d-flex align-items-center gap-2 mb-4">
        <div class="dropdown">
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

        <div class="dropdown">
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
                    <div
                        class="col"
                        role="button"
                        tabindex="0"
                        onclick={() => showAssetDetail(asset.id)}
                        onkeydown={(event) =>
                            handleAssetKeyPress(event, asset.id)}
                        style="cursor: pointer;"
                    >
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
                            <tr
                                role="button"
                                tabindex="0"
                                onclick={() => showAssetDetail(asset.id)}
                                onkeydown={(event) =>
                                    handleAssetKeyPress(event, asset.id)}
                                style="cursor: pointer;"
                            >
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

<!-- Use the reusable SidePanel component -->
<SidePanel
    isOpen={!!selectedAssetId}
    on:close={() => closeAssetDetail(true)}
    position="right"
    width="500px"
    aria-labelledby="assetDetailTitle"
>
    <div
        slot="header"
        class="d-flex align-items-center justify-content-between"
    >
        <div class="d-flex align-items-center gap-2">
            <BaseButton
                icon="chevron-right"
                onClick={() => closeAssetDetail(true)}
                class="btn btn-light border-1 px-2 me-2 rounded-0 border-dark text-decoration-none text-dark"
                aria-label="Close asset detail"
            />
            <h5 id="assetDetailTitle" class="mb-0 text-break">
                {selectedAsset?.filename || "Asset Detail"}
            </h5>
        </div>
        <!-- Optional: Add other header elements here if needed -->
    </div>

    {#if selectedAsset}
        <!-- Pass the selected asset to AssetDetail component -->
        <AssetDetail asset={selectedAsset} />
        <!-- No need for on:close here as SidePanel handles it -->
    {:else}
        <!-- Optional: Placeholder or loading state inside the panel before asset is loaded -->
        <p>Loading...</p>
    {/if}
</SidePanel>

<!-- Removed Bootstrap Offcanvas HTML -->
