<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";

    const { t } = getTranslationStore();

    let {
        mainAsset = $bindable(),
        otherAssets = $bindable([]),
        errors = [],
        class: customClass = "",
        onChange = null,
        // Media type filters - images, audio, and video
        acceptedTypes = ["image", "audio", "video"],
        maxAssets = 10,
    } = $props();

    // Ensure otherAssets is always an array
    if (!Array.isArray(otherAssets)) {
        otherAssets = [];
    }

    // Unified file upload handler
    async function handleMediaUpload() {
        try {
            // Create filter based on accepted types
            const mediaFilters = [];

            // Collect all accepted extensions
            let allExtensions = [];

            const imageExtensions = [
                "jpg",
                "jpeg",
                "png",
                "gif",
                "webp",
                "avif",
            ];
            const audioExtensions = ["mp3", "ogg"];
            const videoExtensions = ["mp4", "webm", "mov"];

            if (acceptedTypes.includes("image")) {
                allExtensions.push(...imageExtensions);
            }
            if (acceptedTypes.includes("audio")) {
                allExtensions.push(...audioExtensions);
            }
            if (acceptedTypes.includes("video")) {
                allExtensions.push(...videoExtensions);
            }

            // Add "All Accepted Formats" as the first (default) option
            if (allExtensions.length > 0) {
                mediaFilters.push({
                    name: "All Accepted Formats",
                    extensions: allExtensions,
                });
            }

            // Add individual type filters
            if (acceptedTypes.includes("image")) {
                mediaFilters.push({
                    name: "Images",
                    extensions: imageExtensions,
                });
            }

            if (acceptedTypes.includes("audio")) {
                mediaFilters.push({
                    name: "Audio",
                    extensions: audioExtensions,
                });
            }

            if (acceptedTypes.includes("video")) {
                mediaFilters.push({
                    name: "Video",
                    extensions: videoExtensions,
                });
            }

            mediaFilters.push({ name: "All Files", extensions: ["*"] });

            const result = await window.api.openFileDialog({
                title: "Select Media Files",
                multiple: true,
                filters: mediaFilters,
            });

            if (!result.canceled && result.filePaths?.length > 0) {
                const fileObjects = result.filePaths.map(createFileObject);
                addMediaFiles(fileObjects);
            }
        } catch (error) {
            console.error("Error selecting media files:", error);
        }
    }

    // Create file object from path
    const createFileObject = (filePath) => ({
        path: filePath,
        name: filePath.split(/[/\\]/).pop(),
        type: "file",
    });

    // Add media files and automatically manage main asset
    function addMediaFiles(fileObjects) {
        const currentAssetCount =
            (mainAsset ? 1 : 0) + (otherAssets?.length || 0);
        const availableSlots = maxAssets - currentAssetCount;

        if (availableSlots <= 0) return;

        const filesToAdd = fileObjects.slice(0, availableSlots);

        // Add all files to the end of other assets
        otherAssets = [...(otherAssets || []), ...filesToAdd];

        // Automatically manage main asset
        updateMainAssetFromOrder();
    }

    // Automatically set the first asset as main asset
    function updateMainAssetFromOrder() {
        const allAssets = [mainAsset, ...(otherAssets || [])].filter(Boolean);

        if (allAssets.length > 0) {
            mainAsset = allAssets[0];
            otherAssets = allAssets.slice(1);
        } else {
            mainAsset = null;
            otherAssets = [];
        }

        // Trigger onChange callback if provided
        if (onChange) {
            onChange({ mainAsset, otherAssets });
        }
    }

    // Remove main asset and automatically reorganize
    function removeMainAsset() {
        mainAsset = null;
        updateMainAssetFromOrder();
    }

    // Remove specific other asset and automatically reorganize
    function removeOtherAsset(index) {
        if (otherAssets && index >= 0 && index < otherAssets.length) {
            otherAssets = otherAssets.filter((_, i) => i !== index);
            updateMainAssetFromOrder();
        }
    }

    // Get total asset count
    const totalAssets = $derived(
        (mainAsset ? 1 : 0) + (otherAssets?.length || 0),
    );
    const canAddMore = $derived(totalAssets < maxAssets);
</script>

<div class={customClass}>
    <!-- Header with upload button -->
    <div class="d-flex flex-column mb-1">
        {#if canAddMore}
            <BaseButton
                type="button"
                class="btn btn-sm btn-link text-dark text-decoration-none"
                icon="plus"
                text={t("common.add-media", { fallback: "Add Media" })}
                onClick={handleMediaUpload}
            />
        {/if}
    </div>

    {#if totalAssets === 0}
        <!-- Empty state -->
        <div class="p-2 text-center">
            <i
                class="bi bi-cloud-upload mb-3 text-muted"
                style="font-size: 1rem;"
            ></i>
            <p class="text-muted mb-1">
                {t("common.no-media-added", { fallback: "No media added yet" })}
            </p>
        </div>
    {:else}
        <!-- Media display - stacked vertically -->
        <div class="d-flex flex-row flex-wrap gap-2">
            <!-- Main Asset -->
            {#if mainAsset}
                <div class="d-flex justify-content-start">
                    <AssetPreview
                        asset={mainAsset}
                        size={100}
                        showRemoveButton={true}
                        onRemove={removeMainAsset}
                    />
                </div>
            {/if}

            <!-- Other Assets -->
            {#if otherAssets && otherAssets.length > 0}
                {#each otherAssets as asset, index}
                    <div class="d-flex justify-content-start">
                        <AssetPreview
                            {asset}
                            size={100}
                            showRemoveButton={true}
                            onRemove={() => removeOtherAsset(index)}
                        />
                    </div>
                {/each}
            {/if}
        </div>
    {/if}
</div>
