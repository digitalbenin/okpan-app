<script>
    import { createEventDispatcher } from "svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";

    export let asset; // The asset object passed as a prop

    const dispatch = createEventDispatcher();

    // Function to format date (could be moved to a utility)
    function formatDate(dateString) {
        if (!dateString) return "N/A";
        try {
            const date = new Date(parseInt(dateString));
            return date.toLocaleString(); // More detailed format
        } catch (e) {
            console.error("Error parsing date:", e);
            return "Invalid Date";
        }
    }

    // Function to get the best image format (similar to InstitutionAssets)
    function getImageSrc(asset) {
        if (!asset || !asset.formats) return asset?.path || null;
        try {
            const formats =
                typeof asset.formats === "string"
                    ? JSON.parse(asset.formats)
                    : asset.formats;
            // Prefer larger formats for detail view
            return (
                formats.lg ||
                formats.md ||
                formats.original ||
                asset.path ||
                null
            );
        } catch (e) {
            console.error("Error parsing formats:", e);
            return asset.path || null;
        }
    }

    // Function to determine if an asset is linked (similar to InstitutionAssets)
    function isAssetLinked(asset) {
        return asset.objectsAssets && asset.objectsAssets.length > 0;
    }

    function handleDelete() {
        // TODO: Implement deletion logic
        // Needs confirmation and likely an API call
        console.log("Delete asset:", asset.id);
        alert(`Deletion for asset ${asset.id} not implemented yet.`);
        // Optionally close the panel after deletion attempt
        // dispatch('close');
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
                objectFit="contain"
                style="max-height: 300px;"
            />
        </div>

        <!-- Asset Details using divs -->
        <div class="asset-details-grid px-2">
            <div class="asset-detail-row">
                <div class="asset-detail-label">Status</div>
                <div class="asset-detail-value">
                    {#if isAssetLinked(asset)}
                        <BaseBadge text="Linked" class="bg-success" />
                    {:else}
                        <BaseBadge
                            text="Not linked"
                            class="bg-warning text-dark"
                        />
                    {/if}
                </div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">ID</div>
                <div class="asset-detail-value">{asset.id || "N/A"}</div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Type</div>
                <div class="asset-detail-value">{asset.type || "N/A"}</div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Size</div>
                <div class="asset-detail-value">
                    {asset.size
                        ? (asset.size / 1024).toFixed(2) + " KB"
                        : "N/A"}
                </div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Dimensions</div>
                <div class="asset-detail-value">
                    {asset.width && asset.height
                        ? `${asset.width} x ${asset.height}`
                        : "N/A"}
                </div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Uploaded</div>
                <div class="asset-detail-value">
                    {formatDate(asset.created_at)}
                </div>
            </div>

            <div class="asset-detail-row">
                <div class="asset-detail-label">Updated</div>
                <div class="asset-detail-value">
                    {formatDate(asset.updated_at)}
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
