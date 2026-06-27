<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
    import { IconSearch, IconUpload } from "@tabler/icons-svelte";
    import { getAssets } from "$lib/api/AssetsApi.js";
    import { watch } from "runed";

    let {
        isOpen = false,
        onClose = null,
        onSave = null,
        initiallySelectedIds = [],
        projectId = null,
        institutionId = null,
    } = $props();

    const { t } = getTranslationStore();

    let page = $state(1);
    const pageSize = 20;
    let search = $state("");
    let isLoading = $state(false);
    let items = $state([]);
    let totalCount = $state(0);
    let selected = $state(new Set(initiallySelectedIds || []));
    let selectedAssetsMap = new Map();

    // Upload state
    let isUploading = $state(false);
    let uploadPercent = $state(0);

    // Keep selected in sync when modal re-opens with different initial values
    watch(() => initiallySelectedIds, (newIds) => {
        selected = new Set(newIds || []);
    });

    async function loadAssets() {
        isLoading = true;
        try {
            const { items: list, totalCount: count } = await getAssets({
                page: Math.max(0, (page || 1) - 1),
                pageSize,
                projectId,
                institutionId,
                type: "image",
                search,
                orderBy: "created_at",
                direction: "desc",
            });
            items = list || [];
            items.forEach((a) => {
                selectedAssetsMap.set(a.id, a);
            });
            totalCount = count || 0;
        } catch (e) {
            console.error("Failed to load assets:", e);
            items = [];
            totalCount = 0;
        } finally {
            isLoading = false;
        }
    }

    async function uploadNewImage() {
        try {
            if (!projectId || !institutionId) return;
            const result = await window.api.openFileDialog({
                title: t("file-upload.select-image", { fallback: "Select Image" }),
                properties: ["openFile", "multiSelections"],
            });

            const filePaths = result?.files?.map((f) => f.path) || result?.filePaths || [];
            if (!filePaths || filePaths.length === 0) return;

            isUploading = true;
            uploadPercent = 0;

            const unsubscribeImportProgress = window.api.onImportProgress((data) => {
                if (data?.status === "progress") {
                    uploadPercent = data.percent || 0;
                }
                if (data?.status === "complete") {
                    uploadPercent = 100;
                    isUploading = false;
                    unsubscribeImportProgress?.();
                }
            });

            const importResult = await window.api.importAssets({
                projectId,
                institutionId,
                isGenericAsset: false,
                files: filePaths,
            });

            const newlyCreated = importResult?.createdAssets || [];
            for (const a of newlyCreated) {
                if (!a?.id) continue;
                selected.add(a.id);
                selectedAssetsMap.set(a.id, a);
            }
            selected = new Set(selected);

            page = 1;
            await loadAssets();
        } catch (e) {
            console.error("Image upload failed:", e);
        } finally {
            unsubscribeImportProgress?.();
            isUploading = false;
        }
    }

    // Load when open and when page/search/filter changes
    watch(
        () => [isOpen, page, search, projectId, institutionId],
        ([open]) => {
            if (!open) return;
            loadAssets();
        }
    );

    function toggleSelect(assetId) {
        if (selected.has(assetId)) {
            selected.delete(assetId);
        } else {
            selected.add(assetId);
        }
        selected = new Set(selected);
    }

    function handleSave() {
        if (onSave) {
            const selectedAssets = Array.from(selected).map(
                (id) => selectedAssetsMap.get(id) || { id },
            );
            onSave(selectedAssets);
        }
        if (onClose) onClose();
    }

    function handleCancel() {
        if (onClose) onClose();
    }
</script>

{#if isOpen}
    <!-- Backdrop -->
    <div
        class="modal-backdrop fade show"
        onclick={handleCancel}
        aria-hidden="true"
    ></div>
    <div
        class="modal fade show link-media-modal"
        tabindex="-1"
        role="dialog"
        style="display: block;"
    >
        <div class="modal-dialog modal-dialog-centered fixed-width">
            <div class="modal-content d-flex flex-column" style="height: 75vh;">
                <div class="modal-header flex-shrink-0">
                    <h5 class="modal-title">
                        {t("objects.linked_media.select_media", {
                            fallback: "Link media",
                        })}
                    </h5>
                    <BaseButton
                        class="btn-close"
                        icon="x"
                        text=""
                        onClick={handleCancel}
                    />
                </div>

                <div class="modal-body flex-grow-1 overflow-auto d-flex flex-column" style="min-height: 0;">
                    <!-- Search & upload bar -->
                    <div class="d-flex gap-2 align-items-center mb-3">
                        <div class="flex-grow-1 border rounded-3 d-flex align-items-center">
                            <div class="d-flex flex-grow-1 align-items-center px-3 py-1">
                                <input
                                    type="text"
                                    class="form-control border-0 shadow-none p-0"
                                    placeholder={t("common.search", { fallback: "Search" })}
                                    bind:value={search}
                                    onkeydown={(e) => e.key === "Enter" && loadAssets()}
                                />
                            </div>
                            <button
                                class="btn btn-link text-body-secondary p-2 d-flex align-items-center"
                                type="button"
                                onclick={loadAssets}
                            >
                                <IconSearch size={16} />
                            </button>
                        </div>
                        <BaseButton
                            class="btn btn-outline-secondary"
                            IconComponent={IconUpload}
                            text={t("common.upload-image", { fallback: "Upload image" })}
                            onClick={uploadNewImage}
                            disabled={isUploading || !projectId || !institutionId}
                        />
                        {#if isUploading}
                            <span class="text-muted small">{uploadPercent}%</span>
                        {/if}
                    </div>

                    <!-- List -->
                    {#if isLoading}
                        <div class="text-center py-4">
                            <div class="spinner-border" role="status">
                                <span class="visually-hidden">{t("common.loading", { fallback: "Loading..." })}</span>
                            </div>
                        </div>
                    {:else if items.length === 0}
                        <div class="text-center py-5 text-muted">
                            {t("common.no-results", { fallback: "No results found" })}
                            {search ? ` for "${search}"` : ""}
                        </div>
                    {:else}
                        <div class="border rounded-3">
                            {#each items as asset, i (asset.id)}
                                <div
                                    class="d-flex align-items-center gap-2 px-2 py-2"
                                    class:border-top={i > 0}
                                    style="height: 71px;"
                                >
                                    <!-- Checkbox -->
                                    <div class="d-flex align-items-center flex-shrink-0" style="width: 20px;">
                                        <input
                                            type="checkbox"
                                            class="form-check-input m-0"
                                            checked={selected.has(asset.id)}
                                            onchange={() => toggleSelect(asset.id)}
                                            style="width: 16px; height: 16px; cursor: pointer;"
                                        />
                                    </div>

                                    <!-- Thumbnail -->
                                    <div class="flex-shrink-0 rounded overflow-hidden" style="width: 55px; height: 55px;">
                                        <BaseImage
                                            asset={asset}
                                            preferredFormat="sm"
                                            alt={asset?.filename || t("media.unnamed-file", { fallback: "Unnamed file" })}
                                            width={55}
                                            height={55}
                                            class="w-100 h-100"
                                            objectFit="cover"
                                            ratio="1/1"
                                            compact={true}
                                        />
                                    </div>

                                    <!-- Filename -->
                                    <div class="flex-grow-1 fw-semibold text-truncate" style="min-width: 0;">
                                        {asset.filename}
                                    </div>
                                </div>
                            {/each}
                        </div>

                        <!-- Pagination -->
                        {#if totalCount > pageSize}
                            <div class="d-flex justify-content-between align-items-center mt-3">
                                <div class="text-muted small">
                                    {selected.size} {t("objects.linked_media.media_linked", { fallback: "media linked" })}
                                </div>
                                <BasePagination bind:page pageSize={pageSize} count={totalCount} size="sm" />
                            </div>
                        {/if}
                    {/if}
                </div>

                <div class="modal-footer flex-shrink-0 d-flex justify-content-end gap-2">
                    <BaseButton
                        class="btn btn-secondary"
                        text={t("common.cancel", { fallback: "Cancel" })}
                        onClick={handleCancel}
                    />
                    <BaseButton
                        class="btn btn-primary"
                        text={t("common.save", { fallback: "Save" })}
                        onClick={handleSave}
                    />
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .link-media-modal .modal-dialog.fixed-width {
        width: 650px;
        max-width: 650px;
    }
    .link-media-modal .border-top {
        border-color: var(--bs-border-color, #d5d6d0) !important;
    }
</style>
