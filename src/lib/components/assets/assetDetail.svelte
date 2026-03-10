<script>
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import { epochToYYYYMMDD } from "$lib/utils/dates.js";
    import { getAssetImageUrl } from "$lib/utils/media.js";

    let {
        asset,
        onDeleteRequest = () => {},
        onUnlinkRequest = (objectId, assetId) => {},
    } = $props();

    // Create derived state for formatted dates
    let createdAtFormatted = $derived(
        asset?.created_at ? epochToYYYYMMDD(asset.created_at) : "",
    );

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
    <div class="d-flex flex-column h-100">
        <div class="mb-3 text-center">
            <BaseImage
                asset={asset}
                preferredFormat="lg"
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

        <!-- Asset Details -->
        <div class="px-2 mb-3 small">
            <div class="mb-3">
                <div class="fw-bold mb-1">Link Status</div>
                <div class="d-flex align-items-center gap-2">
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

            <div class="mb-3">
                <div class="fw-bold mb-1">ID</div>
                <div>{asset.id || "N/A"}</div>
            </div>

            <div class="mb-3">
                <div class="fw-bold mb-1">Type</div>
                <div>{asset.type || "N/A"}</div>
            </div>

            <div class="mb-3">
                <div class="fw-bold mb-1">Size</div>
                <div>
                    {asset.size != null
                        ? (asset.size / 1024).toFixed(2) + " KB"
                        : "N/A"}
                </div>
            </div>

            <div class="mb-3">
                <div class="fw-bold mb-1">Dimensions</div>
                <div>
                    {asset.width != null && asset.height != null
                        ? `${asset.width} x ${asset.height}`
                        : "N/A"}
                </div>
            </div>

            <div class="mb-3">
                <div class="fw-bold mb-1">Uploaded</div>
                <div>
                    {createdAtFormatted || "N/A"}
                </div>
            </div>

            {#if asset.path}
                <div class="mb-3">
                    <div class="fw-bold mb-1">Path</div>
                    <div class="text-break">
                        {asset.path}
                    </div>
                </div>
            {/if}
        </div>

        <!-- Actions -->
        <div class="mt-auto d-flex justify-content-end gap-2">
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
