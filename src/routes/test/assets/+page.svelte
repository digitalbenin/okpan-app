<script>
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseToggle from "$lib/components/base/BaseToggle.svelte";
    import { addToast } from "$lib/components/base/BaseToast.svelte";

    // Get the translation store
    const { t } = getTranslationStore();

    // State variables
    let files = $state([]);
    let isDirectory = $state(false);
    let projectId = $state("");
    let institutionId = $state("");
    let isUploading = $state(false);
    let uploadProgress = $state(0);

    // File selection handler
    async function handleFileSelect() {
        try {
            // Call the IPC method to open the native dialog
            const result = await window.api.openFileDialog({
                isDirectory,
                multiple: !isDirectory,
            });

            if (result.canceled) {
                return;
            }

            // For directory selection, result.filePaths will have one path
            // For file selection, result.filePaths will have one or more paths
            files = result.filePaths.map((path) => ({
                path,
                name: path.split(/[/\\]/).pop(),
                // We'll determine type on the backend
                type: "unknown",
            }));

            console.log("Selected files:", files);
        } catch (error) {
            addToast({
                data: {
                    title: "File selection failed",
                    description: error.message,
                    type: "error",
                },
            });
        }
    }

    // Upload handler
    async function handleUpload() {
        if (files.length === 0) {
            addToast({
                data: {
                    title: "No files selected",
                    description: "Please select files to upload",
                    type: "error",
                },
            });
            return;
        }

        isUploading = true;
        uploadProgress = 0;

        try {
            console.log("uploading assets", files);
            // Prepare the data for IPC
            const data = {
                path: isDirectory ? files[0].path : files.map((f) => f.path),
                isDirectory,
                projectId: projectId || undefined,
                institutionId: institutionId || undefined,
            };

            // Call the IPC method for importing assets
            const result = await window.api.importAssets(data);

            isUploading = false;
            addToast({
                data: {
                    title: "Assets uploaded successfully!",
                    description: "Assets were all successfully uploaded",
                    type: "success",
                },
            });
            files = [];
        } catch (error) {
            isUploading = false;
            addToast({
                data: {
                    title: "Upload failed",
                    description: error.message,
                    type: "error",
                },
            });
        }
    }
</script>

<div class="container-fluid py-4">
    <div class="row mb-4">
        <div class="col-12">
            <h1 class="h3 mb-3">Asset Upload Demo</h1>
            <p class="text-muted">
                Upload images and other assets to your projects
            </p>
        </div>
    </div>

    <div class="row g-4">
        <!-- Upload Form -->
        <div class="col-md-6">
            <div class="card shadow-sm">
                <div class="card-header bg-light">
                    <h5 class="card-title mb-0">Upload Assets</h5>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <BaseToggle
                            label="Upload Directory"
                            bind:value={isDirectory}
                        />
                    </div>

                    <div class="mb-3">
                        <BaseInput
                            label="Project ID"
                            placeholder="Enter project ID"
                            bind:value={projectId}
                        />
                    </div>

                    <div class="mb-3">
                        <BaseInput
                            label="Institution ID (Optional)"
                            placeholder="Enter institution ID"
                            bind:value={institutionId}
                        />
                    </div>

                    <div class="d-flex flex-row gap-2">
                        <BaseButton
                            text={isDirectory
                                ? "Select Directory"
                                : "Select Files"}
                            icon="folder"
                            onClick={handleFileSelect}
                            class="btn btn-outline-primary"
                        />

                        <BaseButton
                            text="Upload Assets"
                            icon="cloud-upload"
                            onClick={handleUpload}
                            disabled={files.length === 0 || isUploading}
                            loading={isUploading}
                            class="btn btn-primary"
                        />
                    </div>

                    {#if isUploading}
                        <div class="mt-3">
                            <div class="progress">
                                <div
                                    class="progress-bar progress-bar-striped progress-bar-animated"
                                    role="progressbar"
                                    style="width: {uploadProgress}%"
                                    aria-valuenow={uploadProgress}
                                    aria-valuemin="0"
                                    aria-valuemax="100"
                                >
                                    {uploadProgress}%
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Selected Files -->
        <div class="col-md-6">
            <div class="card shadow-sm">
                <div
                    class="card-header bg-light d-flex justify-content-between align-items-center"
                >
                    <h5 class="card-title mb-0">Selected Files</h5>
                    <span class="badge bg-primary">{files.length}</span>
                </div>
                <div class="card-body p-0">
                    {#if files.length === 0}
                        <div class="p-4 text-center text-muted">
                            <i class="bi bi-images fs-1"></i>
                            <p class="mt-2">No files selected</p>
                        </div>
                    {:else}
                        <div class="list-group list-group-flush">
                            {#each files as file, index}
                                <div
                                    class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                                >
                                    <div>
                                        <div class="d-flex align-items-center">
                                            <i
                                                class="bi bi-{file.type.startsWith(
                                                    'image/',
                                                )
                                                    ? 'image'
                                                    : 'file-earmark'} me-2"
                                            ></i>
                                            <div>
                                                <div
                                                    class="fw-bold text-truncate"
                                                    style="max-width: 250px;"
                                                >
                                                    {file.name}
                                                </div>
                                                <small class="text-muted"
                                                    >{(
                                                        file.size / 1024
                                                    ).toFixed(1)} KB</small
                                                >
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    /* Add any custom styles here */
    :global(.card) {
        border: none;
        border-radius: 0.5rem;
    }

    :global(.card-header) {
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 0.5rem 0.5rem 0 0 !important;
    }
</style>
