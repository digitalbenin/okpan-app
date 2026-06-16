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
    let isZoneHovered = $state(false);
    let isAddHovered = $state(false);

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
        <div
            class="w-100 rounded-3 py-5 px-3 d-flex flex-column align-items-center justify-content-center text-center"
            role="button"
            tabindex="0"
            style="border: 2px dashed {isDragOver || isZoneHovered ? 'var(--bs-primary)' : 'var(--bs-gray-500)'}; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease;"
            onclick={pickFiles}
            onkeydown={handleKeyDown}
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
            onmouseenter={() => isZoneHovered = true}
            onmouseleave={() => isZoneHovered = false}
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
        <div
            class="rounded-3 p-2 d-flex flex-wrap gap-2"
            role="region"
            aria-label={t("common.drop-zone", { fallback: "Drop zone" })}
            style="border: 2px dashed {isDragOver ? 'var(--bs-primary)' : 'var(--bs-secondary-subtle)'}; transition: border-color 0.15s ease, background-color 0.15s ease; background-color: {isDragOver ? 'rgba(var(--bs-primary-rgb, 0, 128, 96), 0.06)' : 'transparent'};"
            ondragover={handleDragOver}
            ondragleave={handleDragLeave}
            ondrop={handleDrop}
        >
            {#each assets as asset (asset.id)}
                <div class="position-relative">
                    <AssetPreview {asset} size={180} showRemoveButton={false} />
                    <button
                        type="button"
                        class="btn btn-sm btn-light position-absolute top-0 end-0 m-2 p-0 d-flex align-items-center justify-content-center rounded-circle"
                        style="width: 22px; height: 22px;"
                        onclick={() => onRemove(asset)}
                        aria-label={t("common.remove", { fallback: "Remove" })}
                    >
                        <IconX size={14} />
                    </button>
                </div>
            {/each}

            <div
                class="rounded-3 d-flex align-items-center justify-content-center"
                style="width: 180px; height: 180px; cursor: pointer; border: 2px dashed {isAddHovered ? 'var(--bs-primary)' : 'var(--bs-gray-500)'}; transition: border-color 0.15s ease;"
                role="button"
                tabindex="0"
                onclick={pickFiles}
                onkeydown={handleKeyDown}
                onmouseenter={() => isAddHovered = true}
                onmouseleave={() => isAddHovered = false}
            >
                <IconPlus size={20} class="text-body-secondary" />
            </div>
        </div>
    {/if}
</div>
