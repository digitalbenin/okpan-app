<script>
    import { IconUpload, IconX, IconPlus } from "@tabler/icons-svelte";
    import { MEDIA_EXTENSIONS } from "$lib/utils/media.js";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import AssetPreview from "$lib/components/research_fields/AssetPreview.svelte";

    const { t } = getTranslationStore();

    let {
        type = "image", // 'image' | 'video' | 'audio'
        assets = [],
        onAdd = async () => {},
        onRemove = () => {},
    } = $props();

    let isDragOver = $state(false);

    const label = $derived({
        image: t("common.images", { fallback: "Images" }),
        video: t("common.videos", { fallback: "Videos" }),
        audio: t("common.audio", { fallback: "Audio" }),
    }[type] || "");

    const formatChips = $derived(MEDIA_EXTENSIONS[type]?.map((e) => e.toUpperCase()) || []);
    const acceptedExts = $derived(MEDIA_EXTENSIONS[type] || []);

    /** Check whether a File's extension is accepted for this zone. */
    function isAcceptedFile(file) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        return acceptedExts.includes(ext);
    }

    /** Open the system file picker (Electron). */
    async function pickFiles() {
        try {
            const result = await window.api.openFileDialog({
                properties: ["openFile", "multiSelections"],
                filters: [{ name: label, extensions: acceptedExts }],
            });
            if (result?.canceled || !result.filePaths?.length) return;
            await onAdd(result.filePaths);
        } catch (e) {
            console.error("Failed to pick files", e);
        }
    }

    /** Keyboard activation for the clickable zones. */
    function handleKeyDown(e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickFiles();
        }
    }

    /** dragover must preventDefault so the browser allows dropping. */
    function handleDragOver(e) {
        e.preventDefault();
        isDragOver = true;
    }

    function handleDragLeave(e) {
        e.preventDefault();
        isDragOver = false;
    }

    /**
     * Process the drop.
     * 1. Reset highlight.
     * 2. Filter files by accepted extension.
     * 3. Use window.api.getPathForFile() to get real paths in Electron.
     * 4. Pass to parent.
     */
    async function handleDrop(e) {
        e.preventDefault();
        isDragOver = false;

        const files = Array.from(e.dataTransfer?.files || []);
        const paths = files
            .filter(isAcceptedFile)
            .map((f) => {
                // Modern Electron: File.path is not available in renderer.
                // Must use the preload-exposed webUtils.getPathForFile().
                try {
                    return window.api.getPathForFile(f);
                } catch (err) {
                    console.error("[MediaUploadZone] getPathForFile failed:", err);
                    return null;
                }
            })
            .filter(Boolean);

        if (paths.length) await onAdd(paths);
    }
</script>

<div class="d-flex flex-column gap-2">
    {#if assets.length === 0}
        <!-- Empty state: entire zone is a drop target AND a click target -->
        <div
            class="media-upload-zone w-100 d-flex flex-column align-items-center justify-content-center text-center"
            class:is-dragover={isDragOver}
            role="button"
            tabindex="0"
            onclick={pickFiles}
            onkeydown={handleKeyDown}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
        >
            <IconUpload size={20} class="text-body-secondary mb-2" />
            <div class="fw-semibold mb-1">
                {t("common.click-to-select-a-file", { fallback: "Click to select a file" })}
            </div>
            <div class="text-muted small mb-2">
                {t("common.or-drag-and-drop-here", { fallback: "Or drag and drop here" })}
            </div>
            {#if formatChips.length}
                <div class="d-flex gap-1">
                    {#each formatChips as ext}
                        <span class="badge fw-normal text-bg-secondary border">{ext}</span>
                    {/each}
                </div>
            {/if}
        </div>
    {:else}
        <!-- Assets present: the whole grid wrapper is the drop target.
             The plus button is only a click-to-upload trigger. -->
        <div
            class="media-upload-grid d-flex flex-wrap gap-2"
            class:is-dragover={isDragOver}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            role="region"
            aria-label={t("common.drop-zone", { fallback: "Drop zone" })}
        >
            {#each assets as asset (asset.id)}
                <div class="position-relative">
                    <AssetPreview {asset} size={120} showRemoveButton={false} />
                    <button
                        type="button"
                        class="btn btn-sm btn-light position-absolute top-0 end-0 m-1 p-0 d-flex align-items-center justify-content-center"
                        style="width: 22px; height: 22px; border-radius: 50%;"
                        onclick={() => onRemove(asset)}
                        aria-label={t("common.remove", { fallback: "Remove" })}
                    >
                        <IconX size={14} />
                    </button>
                </div>
            {/each}

            <!-- Plus button: click only; drop is handled by the parent grid -->
            <div
                class="media-upload-add d-flex align-items-center justify-content-center"
                style="width: 120px; height: 120px;"
                role="button"
                tabindex="0"
                onclick={pickFiles}
                onkeydown={handleKeyDown}
            >
                <IconPlus size={20} class="text-body-secondary" />
            </div>
        </div>
    {/if}
</div>

<style>
    .media-upload-zone {
        background-color: transparent;
        border: 1px solid #b0b0b0;
        border-radius: 0.5rem;
        padding: 3rem 1rem;
        cursor: pointer;
        transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .media-upload-zone:hover {
        border-color: var(--bs-primary, #008060);
    }
    .media-upload-zone.is-dragover {
        border-color: var(--bs-primary, #008060);
        background-color: rgba(var(--bs-primary-rgb, 0, 128, 96), 0.06);
    }

    .media-upload-grid {
        padding: 0.5rem;
        border: 1px solid transparent;
        border-radius: 0.5rem;
        transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .media-upload-grid.is-dragover {
        border-color: var(--bs-primary, #008060);
        background-color: rgba(var(--bs-primary-rgb, 0, 128, 96), 0.06);
    }

    .media-upload-add {
        background-color: transparent;
        border: 2px solid var(--bs-border-color, #d5d6d0);
        border-radius: 0.5rem;
        cursor: pointer;
        transition: border-color 0.15s ease;
    }
    .media-upload-add:hover {
        border-color: var(--bs-primary, #008060);
    }
</style>
