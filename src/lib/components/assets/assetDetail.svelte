<script>
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import { epochToYYYYMMDD } from "$lib/utils/dates.js";

    let {
        asset,
        onDeleteRequest = () => {},
        onUnlinkRequest = (objectId, assetId) => {},
    } = $props();

    // Create derived state for formatted dates
    let createdAtFormatted = $derived(
        asset?.created_at ? epochToYYYYMMDD(asset.created_at) : "",
    );

    // Function to get the best image format
    function getImageSrc(currentAsset) {
        if (!currentAsset || !currentAsset.formats)
            return currentAsset?.path || null;
        try {
            const formats =
                typeof currentAsset.formats === "string"
                    ? JSON.parse(currentAsset.formats)
                    : currentAsset.formats;
            return (
                formats?.lg ||
                formats?.md ||
                formats?.original ||
                currentAsset.path ||
                null
            );
        } catch (e) {
            console.error("Error parsing formats:", e);
            return currentAsset?.path || null; // Added null check
        }
    }

    // Function to determine if an asset is linked
    function isAssetLinked(currentAsset) {
        return !!(
            currentAsset?.objectsAssets && currentAsset.objectsAssets.length > 0
        );
    }

    // Updated to call parent handler
    function handleDelete() {
        if (asset?.id) {
            onDeleteRequest(asset.id); // Call parent's request handler
        } else {
            console.error("Cannot delete: Asset ID is missing.");
        }
    }

    function handleUnlink(objectId, assetId) {
        if (!objectId || !assetId) {
            console.error("Missing objectId or assetId for unlinking.");
            return;
        }
        onUnlinkRequest(objectId, assetId); // Call the prop function
    }
</script>

{#if asset}
    <div class="asset-detail-container">
        <div class="mb-3 text-center">
            <BaseImage
                src={getImageSrc(asset)
                    ? `media://${getImageSrc(asset)}`
                    : null}
                alt={asset.filename || "Asset Preview"}
                class="img-fluid rounded"
                width={asset.width || 300}
                height={asset.height || 300}
                placeholder="/placeholder.png"
                ratio="1x1"
                objectFit="contain"
                style="max-height: 300px;"
            />
        </div>

        <!-- Asset Details using divs -->
        <div class="asset-details-grid px-2">
            <div class="asset-detail-row">
                <div class="asset-detail-label">Link Status</div>
                <div class="asset-detail-value d-flex align-items-center gap-2">
                    {#if isAssetLinked(asset)}
                        {@const linkedObjectId =
                            asset.objectsAssets[0]?.object_id}
                        {#if linkedObjectId}
                            <BaseBadge value="Linked" class="bg-primary" />

                            <BaseButton
                                text="Unlink"
                                class="btn btn-link text-danger btn-sm p-0 ms-2 px-1"
                                onClick={() =>
                                    handleUnlink(linkedObjectId, asset.id)}
                                title="Unlink asset from object"
                            />
                        {:else}
                            <BaseBadge
                                value="Linked (ID missing)"
                                class="bg-warning text-dark"
                            />
                        {/if}
                    {:else}
                        <BaseBadge value="Unlinked" class="bg-secondary" />
                    {/if}
                </div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">ID</div>
                <div class="asset-detail-value">{asset.id || "N/A"}</div>
                <!-- Null check handled by || -->
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Type</div>
                <div class="asset-detail-value">{asset.type || "N/A"}</div>
                <!-- Null check handled by || -->
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Size</div>
                <div class="asset-detail-value">
                    {asset.size != null // Explicit null/undefined check for size
                        ? (asset.size / 1024).toFixed(2) + " KB"
                        : "N/A"}
                </div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Dimensions</div>
                <div class="asset-detail-value">
                    {asset.width != null && asset.height != null // Explicit null/undefined checks
                        ? `${asset.width} x ${asset.height}`
                        : "N/A"}
                </div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Uploaded</div>
                <div class="asset-detail-value">
                    {createdAtFormatted || "N/A"}
                </div>
            </div>

            {#if asset.path}
                <div class="asset-detail-row">
                    <div class="asset-detail-label">Path</div>
                    <div class="asset-detail-value text-break">
                        {asset.path}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Actions -->
        <div class="mt-4 d-flex justify-content-end gap-2">
            <BaseButton
                text="Delete"
                icon="trash"
                class="btn btn-danger btn-sm"
                onClick={handleDelete}
            />
        </div>
    </div>
{:else}
    <p>No asset selected or asset data is missing.</p>
{/if}

<style>
    .asset-detail-container {
        display: flex;
        flex-direction: column;
        height: 100%; /* Ensure container fills offcanvas body */
    }
    dl {
        font-size: 0.9rem;
    }
    dt {
        font-weight: bold;
    }
    dd {
        margin-bottom: 0.5rem;
    }

    /* Styles for div-based layout */
    .asset-details-grid {
        /* Removed grid properties */
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }

    /* Style for each label-value pair row */
    .asset-detail-row {
        /* Removed display: contents; */
        margin-bottom: 0.75rem; /* Add space between rows */
    }

    .asset-detail-label {
        font-weight: bold;
        /* Removed grid-column: 1; */
        display: block; /* Ensure label takes its own line */
        margin-bottom: 0.1rem; /* Small space between label and value */
    }

    .asset-detail-value {
        /* Removed grid-column: 2; */
        word-break: break-word;
    }
</style>
