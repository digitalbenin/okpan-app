<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { getMediaType, createMediaFilters } from "$lib/utils/media.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";
    import { watch } from "runed";
    import { dragHandleZone, dragHandle } from "svelte-dnd-action";
    import { flip } from "svelte/animate";

    const { t } = getTranslationStore();

    let {
        mainAsset = $bindable(null),
        otherAssets = $bindable([]),
        maxImages = 10,
        maxOtherMedia = 10,
        onChange = null,
    } = $props();

    const flipDurationMs = 200;

    // Separate media into images and other media with IDs for drag and drop
    let imageItems = $state([]);
    let otherMediaItems = $state([]);

    // Helpers
    const assetIdMap = new WeakMap();
    let tempIdCounter = 0;

    const ensureArray = (value) => (Array.isArray(value) ? value : []);
    const isImage = (asset) => getMediaType(asset) === "image";
    const isMediaAsset = (asset) => {
        const type = getMediaType(asset);
        return type === "video" || type === "audio";
    };

    const isSameAsset = (a, b) => {
        if (!a || !b) return false;
        if (a === b) return true;
        if (a.id && b.id && a.id === b.id) return true;
        return false;
    };

    function getStableId(asset, role) {
        if (!asset) return `${role}-unknown`;
        if (asset.id) return `${role}-${asset.id}`;

        if (!assetIdMap.has(asset)) {
            assetIdMap.set(asset, `temp-${tempIdCounter++}`);
        }

        return `${role}-${assetIdMap.get(asset)}`;
    }

    const buildItem = (asset, role, extra = {}) => ({
        id: getStableId(asset, role),
        asset,
        ...extra,
    });

    const getImageAssets = () => ensureArray(otherAssets).filter(isImage);
    const getNonImageAssets = () => ensureArray(otherAssets).filter((asset) => !isImage(asset));
    const extractAssets = (items) => items.map(({ asset }) => asset);

    const createImageItems = () => {
        const items = [];

        if (mainAsset && isImage(mainAsset)) {
            items.push(buildItem(mainAsset, "image-main", { isMain: true }));
        }

        for (const asset of getImageAssets()) {
            if (isSameAsset(asset, mainAsset)) continue;
            items.push(buildItem(asset, "image-other", { isMain: false }));
        }

        return items;
    };

    const createOtherMediaItems = () =>
        ensureArray(otherAssets)
            .filter(isMediaAsset)
            .map((asset) => buildItem(asset, "media"));

    watch([() => mainAsset, () => otherAssets], () => {
        imageItems = createImageItems();
    }, { immediate: true });

    watch(() => otherAssets, () => {
        otherMediaItems = createOtherMediaItems();
    }, { immediate: true });

    const canAddImage = $derived(imageItems.length < maxImages);
    const canAddOtherMedia = $derived(otherMediaItems.length < maxOtherMedia);

    // Unified upload handler
    async function handleMediaUpload(mediaType, addFunction, maxCount, currentCount) {
        try {
            const types = mediaType === "image" ? ["image"] : ["video", "audio"];
            const filters = createMediaFilters(types);
            const title = mediaType === "image" ? "Select Images" : "Select Media Files";
            
            const result = await window.api.openFileDialog({
                title,
                properties: ["openFile", "multiSelections"],
                filters,
            });

            const filePaths = result?.files?.map((f) => f.path) || result?.filePaths || [];
            if (!result.canceled && filePaths.length > 0) {
                const availableSlots = maxCount - currentCount;
                const fileObjects = filePaths.slice(0, availableSlots).map(createFileObject);
                addFunction(fileObjects);
            }
        } catch (error) {
            console.error(`Error selecting ${mediaType} files:`, error);
        }
    }

    const handleImageUpload = () => handleMediaUpload("image", addImages, maxImages, imageItems.length);
    const handleOtherMediaUpload = () => handleMediaUpload("other", addOtherMedia, maxOtherMedia, otherMediaItems.length);

    function createFileObject(filePath) {
        const name = filePath.split(/[/\\]/).pop() ?? filePath;
        return {
            path: filePath,
            name,
            filename: name,
            type: "file",
        };
    }

    function updateAssets(images, otherMedia) {
        const [nextMain, ...remainingImages] = images;
        mainAsset = nextMain || null;
        otherAssets = [...remainingImages, ...otherMedia];
        notifyChange();
    }

    function addImages(fileObjects) {
        const currentImages = extractAssets(imageItems);
        updateAssets([...currentImages, ...fileObjects], getNonImageAssets());
    }

    function addOtherMedia(fileObjects) {
        const currentOtherMedia = extractAssets(otherMediaItems);
        updateAssets(getImageAssets(), [...currentOtherMedia, ...fileObjects]);
    }

    function removeImage(imageItem) {
        const filtered = extractAssets(imageItems).filter((img) => !isSameAsset(img, imageItem.asset));
        updateAssets(filtered, getNonImageAssets());
    }

    function removeOtherMedia(mediaItem) {
        const filtered = extractAssets(otherMediaItems).filter((media) => !isSameAsset(media, mediaItem.asset));
        updateAssets(getImageAssets(), filtered);
    }

    function handleDnd(event, itemsSetter) {
        itemsSetter([...event.detail.items]);
    }

    function handleImageDndFinalize(event) {
        imageItems = [...event.detail.items];
        updateAssets(extractAssets(event.detail.items), getNonImageAssets());
    }

    function handleOtherMediaDndFinalize(event) {
        otherMediaItems = [...event.detail.items];
        updateAssets(getImageAssets(), extractAssets(event.detail.items));
    }

    function notifyChange() {
        if (onChange) {
            onChange({ mainAsset, otherAssets });
        }
    }
</script>

<div class="vocabulary-media-manager">
    <!-- Images Section -->
    <div class="mb-4">
        <div class="d-flex align-items-center justify-content-between mb-3">
            <div class="d-flex align-items-center gap-2">
                <p class="mb-0">
                    {t("common.images", { fallback: "Images" })}
                </p>
                <BaseTooltip>
                    {#snippet trigger(props)}
                        <i class="bi bi-info-circle text-muted" {...props}></i>
                    {/snippet}
                    {t("vocabulary.images-tooltip", { 
                        fallback: "The first image will be used as the main preview for this vocabulary option" 
                    })}
                </BaseTooltip>
            </div>
            <BaseButton
                type="button"
                class="btn btn-sm btn-outline-secondary"
                icon="plus"
                text={t("common.add-image", { fallback: "Add Image" })}
                onClick={handleImageUpload}
                disabled={!canAddImage}
            />
        </div>

       
        {#if imageItems.length === 0}
            <div class="py-1 text-muted d-flex align-items-center gap-2">
                <i class="bi bi-image fs-3" style="opacity: 0.5;"></i>
                <span>{t("common.no-images", { fallback: "No images added" })}</span>
            </div>
        {:else}
            <div
                class="linked-assets"
                use:dragHandleZone={{
                    dropTargetStyle: { outline: "none" },
                    items: imageItems,
                    flipDurationMs,
                }}
                onconsider={(e) => handleDnd(e, (items) => imageItems = items)}
                onfinalize={handleImageDndFinalize}
            >
                {#each imageItems as imageItem (imageItem.id)}
                    {@const asset = imageItem.asset}
                    <div
                        class="d-flex align-items-center gap-2 mb-2"
                        animate:flip={{ duration: flipDurationMs }}
                    >
                        <!-- Asset Preview with Main badge -->
                        <div class="flex-shrink-0 position-relative">
                            {#if imageItem.isMain}
                                <div class="position-absolute" style="top: -8px; left: -8px; z-index: 10;">
                                    <span class="badge bg-primary" style="font-size: 0.65rem;">
                                        {t("common.main", { fallback: "Main" })}
                                    </span>
                                </div>
                            {/if}
                            <AssetPreview
                                {asset}
                                size={80}
                                showRemoveButton={false}
                            />
                        </div>

                        <!-- Filename (flexible width) -->
                        <div class="flex-grow-1" style="min-width: 0;">
                            <span class="text-dark fw-medium d-block" style="font-size: 12px; word-break: break-word;" title={asset?.filename || asset?.name || "Unnamed file"}>
                                {asset?.filename || asset?.name || "Unnamed file"}
                            </span>
                        </div>

                        <!-- Drag handle -->
                        <button
                            class="btn btn-link text-muted p-1 flex-shrink-0 drag-handle"
                            style="cursor: grab; width: 32px;"
                            aria-label="drag item"
                            use:dragHandle
                        >
                            <i class="bi bi-grip-vertical"></i>
                        </button>

                        <!-- Delete button -->
                        <button
                            class="btn btn-sm btn-outline-danger flex-shrink-0"
                            style="width: 32px; height: 32px; padding: 0;"
                            type="button"
                            onclick={(e) => {
                                e.stopPropagation();
                                removeImage(imageItem);
                            }}
                            title={t("common.remove", { fallback: "Remove" })}
                            aria-label={t("common.remove", { fallback: "Remove" })}
                        >
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- Other Media Section -->
    <div class="mb-3">
        <div class="d-flex align-items-center justify-content-between mb-2">
            <p class="mb-0">
                {t("common.other-media", { fallback: "Other media" })}
            </p>
            <BaseButton
                type="button"
                class="btn btn-sm btn-outline-secondary"
                icon="plus"
                text={t("common.add-media", { fallback: "Add Media" })}
                onClick={handleOtherMediaUpload}
                disabled={!canAddOtherMedia}
            />
        </div>

        {#if otherMediaItems.length === 0}
            <div class="py-1 text-muted d-flex align-items-center gap-2">
                <i class="bi bi-film fs-3" style="opacity: 0.5;"></i>
                <span>{t("common.no-other-media", { fallback: "No video or audio added" })}</span>
            </div>
        {:else}
            <div
                class="linked-assets"
                use:dragHandleZone={{
                    dropTargetStyle: { outline: "none" },
                    items: otherMediaItems,
                    flipDurationMs,
                }}
                onconsider={(e) => handleDnd(e, (items) => otherMediaItems = items)}
                onfinalize={handleOtherMediaDndFinalize}
            >
                {#each otherMediaItems as mediaItem (mediaItem.id)}
                    {@const asset = mediaItem.asset}
                    <div
                        class="d-flex align-items-center gap-2 mb-2"
                        animate:flip={{ duration: flipDurationMs }}
                    >
                        <!-- Asset Preview -->
                        <div class="flex-shrink-0">
                            <AssetPreview
                                {asset}
                                size={80}
                                showRemoveButton={false}
                            />
                        </div>

                        <!-- Filename (flexible width) -->
                        <div class="flex-grow-1" style="min-width: 0;">
                            <span class="text-dark fw-medium d-block" style="font-size: 12px; word-break: break-word;" title={asset?.filename || asset?.name || "Unnamed file"}>
                                {asset?.filename || asset?.name || "Unnamed file"}
                            </span>
                        </div>

                        <!-- Drag handle -->
                        <button
                            class="btn btn-link text-muted p-1 flex-shrink-0 drag-handle"
                            style="cursor: grab; width: 32px;"
                            aria-label="drag item"
                            use:dragHandle
                        >
                            <i class="bi bi-grip-vertical"></i>
                        </button>

                        <!-- Delete button -->
                        <button
                            class="btn btn-sm btn-outline-danger flex-shrink-0"
                            style="width: 32px; height: 32px; padding: 0;"
                            type="button"
                            onclick={(e) => {
                                e.stopPropagation();
                                removeOtherMedia(mediaItem);
                            }}
                            title={t("common.remove", { fallback: "Remove" })}
                            aria-label={t("common.remove", { fallback: "Remove" })}
                        >
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
