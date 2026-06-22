<script>
    import { IconUpload } from "@tabler/icons-svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    const { t } = getTranslationStore();

    let {
        onSelect = async () => {},
        acceptedFormats = ["csv", "json", "xml", "tsv", "xlsx"],
    } = $props();

    let isDragOver = $state(false);
    let isZoneHovered = $state(false);

    
    /** Open the system file picker (Electron). */
    async function pickFile() {
        try {
            const result = await window.api.openFileDialog({
                properties: ["openFile"],
                filters: [
                    {
                        name: t("common.data-files", { fallback: "Data Files" }),
                        extensions: acceptedFormats,
                    },
                ],
            });
            if (result?.canceled || !result.filePaths?.length) return;

            const filePath = result.filePaths[0];
            await onSelect(filePath);
        } catch (e) {
            console.error("Failed to pick file", e);
        }
    }

    /** Keyboard activation for the clickable zone. */
    function handleKeyDown(e) {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pickFile();
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        isDragOver = true;
    }

    function handleDragLeave(e) {
        e.preventDefault();
        isDragOver = false;
    }

    async function handleDrop(e) {
        e.preventDefault();
        isDragOver = false;

        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;

        // Check if the file has an accepted extension
        const file = files[0];
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (!acceptedFormats.includes(ext)) return;

        try {
            const filePath = window.api.getPathForFile(file);
            if (filePath) await onSelect(filePath);
        } catch (err) {
            console.error("[DataFileUploadZone] getPathForFile failed:", err);
        }
    }
</script>

<div
    class="w-100 rounded-4 py-5 px-3 d-flex flex-column align-items-center justify-content-center text-center gap-3"
    role="button"
    tabindex="0"
    style="border: 2px dashed {isDragOver || isZoneHovered ? 'var(--bs-primary)' : '#d5d6d0'}; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease;"
    onclick={pickFile}
    onkeydown={handleKeyDown}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    onmouseenter={() => isZoneHovered = true}
    onmouseleave={() => isZoneHovered = false}
>
    <IconUpload size={24} class="text-body-secondary" stroke={1.5} />
    <div class="d-flex flex-column gap-2">
        <div class="fw-semibold text-body-secondary">
            {t("import.click-to-select-file", { fallback: "Click to select a file" })}
        </div>
        <div class="text-body-secondary" style="font-size: 14px;">
            {t("import.or-drag-and-drop-here", { fallback: "Or drag and drop here" })}
        </div>
    </div>
    {#if acceptedFormats.length}
        <div class="d-flex gap-2">
            {#each acceptedFormats as ext}
                <span class="badge bg-secondary fw-normal rounded-2">{ext.toUpperCase()}</span>
            {/each}
        </div>
    {/if}
</div>
