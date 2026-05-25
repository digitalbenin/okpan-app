<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import { getAssets } from "$lib/api/AssetsApi.js";

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
    const pageSize = 20; // fixed per requirement
    let search = $state("");
    let isLoading = $state(false);
    let items = $state([]);
    let totalCount = $state(0);
    let selected = $state(new Set(initiallySelectedIds || []));
    // Cache of assets we've seen while paginating/searching, so we can return full objects on Save
    let selectedAssetsMap = new Map();

    // Upload state
    let isUploading = $state(false);
    let uploadPercent = $state(0);

    // Keep selected in sync when modal re-opens with different initial values
    $effect(() => {
        selected = new Set(initiallySelectedIds || []);
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
            // Update cache for quick lookup on save
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

    // Handle image upload via Electron file dialog and backend import
    async function uploadNewImage() {
        try {
            if (!projectId) {
                console.error("Image upload failed: Project ID is required");
                alert("Please select an institution (project) before uploading images.");
                return;
            }
            if (!institutionId) {
                console.error("Image upload failed: Institution ID is required");
                alert("Please select an institution before uploading images.");
                return;
            }
            const result = await window.api.openFileDialog({
                title: t("file-upload.select-image", { fallback: "Select Image" }),
                properties: ["openFile", "multiSelections"],
            });

            const filePaths = result?.files?.map((f) => f.path) || result?.filePaths || [];
            if (!filePaths || filePaths.length === 0) return;

            isUploading = true;
            uploadPercent = 0;

            // Listen to progress events while importing
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
            // Auto-add uploaded assets to selection and cache
            for (const a of newlyCreated) {
                if (!a?.id) continue;
                selected.add(a.id);
                selectedAssetsMap.set(a.id, a);
            }
            selected = new Set(selected);

            // Refresh to show new assets (sorted by created_at desc)
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
    $effect(() => {
        if (!isOpen) return;
        // track dependencies for reactive reload
        page;
        search;
        projectId;
        institutionId;
        loadAssets();
    });

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
            // Return selected asset objects from cache (covers multi-page selections)
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
                            fallback: "Select media to link",
                        })}
                    </h5>
                    <BaseButton
                        class="btn-close"
                        icon="x"
                        text=""
                        onClick={handleCancel}
                    />
                </div>

                <div class="modal-body flex-grow-1 overflow-auto" style="min-height: 0;">
                    <!-- Search -->
                    <div class="input-group mb-3">
                        <span class="input-group-text"
                            ><i class="bi bi-search"></i></span
                        >
                        <input
                            class="form-control"
                            type="text"
                            placeholder={t("common.search", {
                                fallback: "Search",
                            })}
                            bind:value={search}
                            onkeydown={(e) => e.key === "Enter" && loadAssets()}
                        />
                        <button
                            class="btn btn-outline-secondary"
                            type="button"
                            onclick={loadAssets}
                        >
                            {t("common.search", { fallback: "Search" })}
                        </button>
                        <button
                            class="btn btn-outline-secondary ms-2"
                            type="button"
                            onclick={uploadNewImage}
                            disabled={isUploading || !projectId || !institutionId}
                        >
                            <i class="bi bi-upload"></i>
                            {t("common.upload-image", { fallback: "Upload image" })}
                        </button>
                        {#if isUploading}
                            <span class="ms-2 text-muted small align-self-center">
                                {uploadPercent}%
                            </span>
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
                            {t("common.no-results", {
                                fallback: "No results found",
                            })}{search ? ` for "${search}"` : ""}
                        </div>
                    {:else}
                        <div class="list-group">
                            {#each items as asset (asset.id)}
                                <div
                                    class="list-group-item d-flex align-items-center gap-3"
                                >
                                    <div
                                        class="flex-shrink-0"
                                        style="width: 64px; height: 64px;"
                                    >
                                        <BaseImage
                                            asset={asset}
                                            preferredFormat="sm"
                                            alt={asset?.filename || t("media.unnamed-file", { fallback: "Unnamed file" })}
                                            width={64}
                                            height={64}
                                            class="rounded"
                                            ratio="1/1"
                                            compact={true}
                                        />
                                    </div>
                                    <div class="flex-grow-1 min-w-0">
                                        <div class="fw-medium text-truncate">
                                            {asset.filename}
                                        </div>
                                    </div>
                                    <div class="flex-shrink-0">
                                        {#if selected.has(asset.id)}
                                            <span
                                                class="btn btn-success btn-sm disabled"
                                            >
                                                <i class="bi bi-check2"></i>
                                                {t("common.added", {
                                                    fallback: "Added",
                                                })}
                                            </span>
                                        {:else}
                                            <button
                                                class="btn btn-outline-secondary btn-sm"
                                                type="button"
                                                onclick={() =>
                                                    toggleSelect(asset.id)}
                                            >
                                                <i class="bi bi-plus-lg"></i>
                                                {t("common.add", {
                                                    fallback: "Add",
                                                })}
                                            </button>
                                        {/if}
                                    </div>
                                </div>
                            {/each}
                        </div>

                        <!-- Pagination (BasePagination component) -->
                        {#if totalCount > pageSize}
                            <div class="d-flex justify-content-between align-items-center mt-3">
                                <div class="text-muted">
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
    .list-group-item {
        border: 1px solid rgba(108, 117, 125, 0.25);
        border-radius: 0.5rem;
        margin-bottom: 0.5rem;
    }

    /* Fixed width for the modal dialog */
    .link-media-modal .modal-dialog.fixed-width {
        width: 900px;
        max-width: 900px;
    }
</style>
