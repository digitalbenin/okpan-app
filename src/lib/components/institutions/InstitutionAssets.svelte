<script>
    import { page } from "$app/stores";
    import { page as pageData } from "$app/state";
    import { goto, invalidateAll } from "$app/navigation";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import AssetDetail from "$lib/components/assets/assetDetail.svelte";
    import SidePanel from "$lib/components/common/SidePanel.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import { deleteAsset } from "$lib/stores/AssetsUtils.js";
    import { unlinkAssetFromObject } from "$lib/stores/ObjectsUtils.js";

    // Get assets from context
    //let initialAssets = getContext("assets") || [];
    let assetsList = $derived(pageData.data.assets);

    // Display mode state
    let displayMode = $state("grid"); // 'grid' or 'list'

    // Selected asset state
    let selectedAssetId = $state(null);
    let selectedAsset = $state(null);
    let closeContentTimeout = null; // Added to manage timeout

    // Modal state for asset deletion
    let isDeleteAssetModalOpen = $state(false);
    let assetIdToDelete = $state(null);

    // Modal state for asset unlinking
    let isUnlinkConfirmModalOpen = $state(false);
    let unlinkDetails = $state({ objectId: null, assetId: null });

    // --- New $effect for URL Synchronization ---
    $effect(() => {
        const urlAssetId = $page.url.searchParams.get("assetId");

        // Convert null/undefined to string for comparison if needed, or handle nulls directly
        const currentSelectedIdStr = selectedAssetId
            ? String(selectedAssetId)
            : null;
        const currentUrlIdStr = urlAssetId ? String(urlAssetId) : null;

        if (currentUrlIdStr && currentUrlIdStr !== currentSelectedIdStr) {
            // URL has an ID, and it's different from the current state -> Open/switch panel
            showAssetDetail(currentUrlIdStr, false); // Don't push state again if triggered by URL
        } else if (!currentUrlIdStr && currentSelectedIdStr) {
            // URL has no ID, but state does -> Close panel
            closeAssetDetail(false); // Don't push state again if triggered by URL
        }
        // If URL and state match, or both are null, do nothing.
    });
    // --- End $effect ---

    // Function to find asset by ID
    function findAssetById(id) {
        // Assuming asset IDs are numbers or strings that need comparison
        return (
            assetsList.find((asset) => String(asset.id) === String(id)) || null
        );
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
            selectedAssetId = newAssetId;
            selectedAsset = asset;
            // The panel will open reactively based on selectedAssetId

            if (updateUrl) {
                const currentPath = $page.url.pathname;
                const currentParams = new URLSearchParams($page.url.search);
                currentParams.set("assetId", newAssetId);
                goto(`${currentPath}?${currentParams.toString()}`, {
                    keepfocus: true,
                    noscroll: true,
                    replaceState: false, // Use false to allow back button navigation
                });
            }
        } else if (!newAssetId) {
            closeAssetDetail(true); // Close if asset not found
        }
    }

    // Function to close asset detail panel
    function closeAssetDetail(updateUrl = true) {
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

    // Request handler from child component to open modal
    function handleAssetDeleteRequest(assetId) {
        if (assetId) {
            assetIdToDelete = assetId;
            isDeleteAssetModalOpen = true;
        } else {
            console.error("Delete request received without Asset ID.");
        }
    }

    // Adjusted to accept objectId and assetId directly
    function handleAssetUnlinkRequest(objectId, assetId) {
        if (objectId && assetId) {
            unlinkDetails = { objectId, assetId };
            isUnlinkConfirmModalOpen = true;
        } else {
            console.error("Unlink request received with missing IDs.");
        }
    }

    // Function called when deletion is confirmed in the modal
    async function confirmAssetDelete() {
        if (!assetIdToDelete) {
            console.error("Cannot confirm delete: assetIdToDelete is null");
            isDeleteAssetModalOpen = false;
            return;
        }

        const result = await deleteAsset(assetIdToDelete);

        if (result.error) {
            console.error("Error deleting asset:", result.error);
            alert(`Error deleting asset: ${result.error}`); // Keep alert for now
        } else {
            closeAssetDetail(true);
        }
        invalidateAll();
        // Reset modal state
        isDeleteAssetModalOpen = false;
        assetIdToDelete = null;
    }

    // Function called when unlinking is confirmed in the modal
    async function confirmAssetUnlink() {
        if (!unlinkDetails.objectId || !unlinkDetails.assetId) {
            console.error("Cannot confirm unlink: Missing objectId or assetId");
            isUnlinkConfirmModalOpen = false;
            return;
        }

        const result = await unlinkAssetFromObject(
            unlinkDetails.objectId,
            unlinkDetails.assetId,
        );

        if (result.error) {
            console.error("Error unlinking asset:", result.error);
            alert(`Error unlinking asset: ${result.error}`); // Keep alert for now
        } else {
            console.log("Asset unlinked successfully:", result.result);
            /*const targetAssetIndex = assetsList.findIndex(
                (a) => a.id === unlinkDetails.assetId,
            );
            if (targetAssetIndex !== -1) {
                const updatedAsset = { ...assetsList[targetAssetIndex] };
                updatedAsset.objectsAssets = updatedAsset.objectsAssets.filter(
                    (oa) => oa.object_id !== unlinkDetails.objectId,
                );
                const newAssetsList = [...assetsList];
                newAssetsList[targetAssetIndex] = updatedAsset;
                //assetsList = newAssetsList;

                // If the currently selected asset is the one unlinked, update its details
                if (
                    selectedAsset &&
                    selectedAsset.id === unlinkDetails.assetId
                ) {
                    selectedAsset = updatedAsset;
                }
            }*/
        }

        // Reset modal state
        invalidateAll();
        isUnlinkConfirmModalOpen = false;
        unlinkDetails = { objectId: null, assetId: null };
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
                <!-- Using BaseButton again -->
                <BaseButton
                    icon="grid-3x3-gap-fill"
                    class="btn btn-sm {displayMode === 'grid'
                        ? 'btn-primary'
                        : 'btn-outline-secondary'}"
                    onClick={() => (displayMode = "grid")}
                    aria-label="Grid view"
                />
                <!-- Using BaseButton again -->
                <BaseButton
                    icon="list-ul"
                    class="btn btn-sm {displayMode === 'list'
                        ? 'btn-primary'
                        : 'btn-outline-secondary'}"
                    onClick={() => (displayMode = "list")}
                    aria-label="List view"
                />
            </div>
        </div>
        <div class="d-flex align-items-center gap-2">
            <BaseButton
                text="Import assets"
                icon="upload"
                class="btn btn-sm btn-primary"
                disabled
                onClick={() => {
                    /* TODO: Implement import */
                }}
            />
        </div>
    </div>

    <!-- Control Row 2: Sort, Filter -->
    <!-- <div class="d-flex align-items-center gap-2 mb-4">
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
  </div> -->

    <!-- Assets Grid -->
    {#if displayMode === "grid"}
        <div class="row row-cols-1 row-cols-md-2 row-cols-lg-5 g-3">
            {#if assetsList.length === 0}
                <div class="col-12 text-center py-5">
                    <p class="text-muted">
                        No assets found for this institution.
                    </p>
                    <button class="btn btn-primary mt-2">
                        <i class="bi bi-upload me-1"></i> Import assets
                    </button>
                </div>
            {:else}
                {#each assetsList as asset, i}
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
                        <th
                            ><button class="btn btn-sm btn-dark">Preview</button
                            ></th
                        >
                        <th
                            ><button class="btn btn-sm btn-dark"
                                >Filename</button
                            ></th
                        >
                        <th
                            ><button class="btn btn-sm btn-dark">Date</button
                            ></th
                        >
                        <th
                            ><button class="btn btn-sm btn-dark">Type</button
                            ></th
                        >
                        <th
                            ><button class="btn btn-sm btn-dark">Status</button
                            ></th
                        >
                    </tr>
                </thead>
                <tbody>
                    {#if assetsList.length === 0}
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
                        {#each assetsList as asset, i}
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
        <AssetDetail
            asset={selectedAsset}
            onDeleteRequest={handleAssetDeleteRequest}
            onUnlinkRequest={handleAssetUnlinkRequest}
        />
        <!-- No need for on:close here as SidePanel handles it -->
    {:else}
        <!-- Optional: Placeholder or loading state inside the panel before asset is loaded -->
        <p>Loading...</p>
    {/if}
</SidePanel>

{#snippet header()}
    Confirm Deletion
{/snippet}

{#snippet deleteBody()}
    Are you sure you want to delete this asset? This action cannot be undone.
{/snippet}

{#snippet deleteActions()}
    <div class="d-flex justify-content-end gap-2">
        <BaseButton
            text="Cancel"
            class="btn btn-secondary btn-sm"
            onClick={() => {
                isDeleteAssetModalOpen = false;
                assetIdToDelete = null;
            }}
        />
        <BaseButton
            text="Confirm Delete"
            class="btn btn-danger btn-sm"
            onClick={confirmAssetDelete}
        />
    </div>
{/snippet}

<!-- Render the asset delete modal -->
{#if isDeleteAssetModalOpen}
    <BaseModal
        bind:isOpen={isDeleteAssetModalOpen}
        size="md"
        {header}
        body={deleteBody}
        actions={deleteActions}
    />
{/if}

{#snippet unlinkHeader()}
    Confirm Unlink
{/snippet}

{#snippet unlinkBody()}
    Are you sure you want to unlink this asset from the object?
{/snippet}

{#snippet unlinkActions()}
    <div class="d-flex justify-content-end gap-2">
        <BaseButton
            text="Cancel"
            class="btn btn-secondary btn-sm"
            onClick={() => {
                isUnlinkConfirmModalOpen = false;
                unlinkDetails = { objectId: null, assetId: null };
            }}
        />
        <BaseButton
            text="Confirm Unlink"
            class="btn btn-danger btn-sm"
            onClick={confirmAssetUnlink}
        />
    </div>
{/snippet}

<!-- Render the asset unlink modal -->
{#if isUnlinkConfirmModalOpen}
    <BaseModal
        bind:isOpen={isUnlinkConfirmModalOpen}
        size="md"
        header={unlinkHeader}
        body={unlinkBody}
        actions={unlinkActions}
    />
{/if}

<!-- Removed Bootstrap Offcanvas HTML -->
