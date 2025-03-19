<script>
    import { addToast } from "$lib/components/base/BaseToast.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";

    // File import state
    let isImporting = $state(false);
    let fileInputRef;
    let dragOver = $state(false);

    // File handling
    function handleFileChange(event) {
        const files = event.target?.files;
        if (files?.length) {
            processFile(files[0]);
        }
    }

    function handleDrop(event) {
        event.preventDefault();
        dragOver = false;

        const files = event.dataTransfer?.files;
        if (files?.length) {
            processFile(files[0]);
        }
    }

    function handleDragOver(event) {
        event.preventDefault();
        dragOver = true;
    }

    function handleDragLeave() {
        dragOver = false;
    }

    async function processFile(file) {
        if (!file) return;

        try {
            isImporting = true;

            // Here you would implement the actual file processing
            // For now, just a placeholder showing a success message

            console.log("Processing file:", file.name);

            // Example implementation:
            // const content = await file.text();
            // const projectData = JSON.parse(content);
            // await importProjectFromData(projectData);

            // Success message
            addToast({
                data: {
                    title: "Success",
                    description: `File "${file.name}" imported successfully!`,
                    type: "success",
                },
            });
        } catch (error) {
            console.error("Failed to import project from file:", error);
            addToast({
                data: {
                    title: "Error",
                    description: `Failed to import file: ${error.message}`,
                    type: "error",
                },
            });
        } finally {
            isImporting = false;
        }
    }

    function openFileBrowser() {
        fileInputRef.click();
    }
</script>

<div class="mt-3">
    <div
        class="border rounded p-5 text-center d-flex flex-row align-items-center justify-content-center"
        style="min-height: 150px; {dragOver
            ? 'background-color: rgba(13, 110, 253, 0.1);'
            : ''}"
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        role="region"
        aria-label="File drop zone"
    >
        <p
            class="mb-3 d-flex flex-row align-items-center justify-content-center"
        >
            <span class="me-2">Drag a file here or</span>
            <BaseButton
                text="browse"
                class="btn btn-sm btn-primary"
                disabled={isImporting}
                onClick={openFileBrowser}
            />
            <span class="ms-2">a file from your computer</span>
        </p>

        <input
            type="file"
            style="display: none;"
            accept=".json"
            onchange={handleFileChange}
            bind:this={fileInputRef}
            disabled={isImporting}
        />

        {#if isImporting}
            <div class="mt-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p class="mt-2">Importing project...</p>
            </div>
        {/if}
    </div>
</div>
