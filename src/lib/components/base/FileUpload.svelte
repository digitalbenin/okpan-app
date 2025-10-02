<script>
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    let {
        value = $bindable(null),
        accept = "*/*",
        label = "Upload File",
        placeholder = "Choose file...",
        multiple = false,
        required = false,
        class: customClass = "",
        errors = [],
        disabled = false,
        maxSize = null, // Max file size in bytes
        allowedTypes = null, // Array of allowed MIME types
    } = $props();

    let fileInput;
    let isDragOver = $state(false);
    let uploadProgress = $state(0);
    let isUploading = $state(false);

    // Reactive filename display
    const displayName = $derived.by(() => {
        if (!value) return placeholder;
        if (Array.isArray(value)) {
            if (value.length === 0) return placeholder;
            if (value.length === 1) return value[0]?.name || "File selected";
            return `${value.length} files selected`;
        }
        if (value instanceof File) return value.name;
        if (typeof value === "string") return value.split("/").pop() || value;
        return "File selected";
    });

    function handleFileSelect(files) {
        if (!files || files.length === 0) return;

        if (multiple) {
            // Handle multiple files
            const validFiles = [];
            for (const file of Array.from(files)) {
                // Validate file size
                if (maxSize && file.size > maxSize) {
                    dispatch("error", {
                        type: "size",
                        message: `File ${file.name} size exceeds ${formatFileSize(maxSize)} limit`,
                        file,
                    });
                    continue;
                }

                // Validate file type
                if (allowedTypes && !allowedTypes.includes(file.type)) {
                    dispatch("error", {
                        type: "type",
                        message: `File ${file.name} type ${file.type} not allowed`,
                        file,
                    });
                    continue;
                }

                validFiles.push(file);
            }

            value = validFiles;
            dispatch("fileSelected", { files: validFiles });
            // Also emit a generic change event for integrators (e.g., AutoForm)
            dispatch("change", { value: validFiles });
        } else {
            // Handle single file
            const file = files[0];

            // Validate file size
            if (maxSize && file.size > maxSize) {
                dispatch("error", {
                    type: "size",
                    message: `File size exceeds ${formatFileSize(maxSize)} limit`,
                    file,
                });
                return;
            }

            // Validate file type
            if (allowedTypes && !allowedTypes.includes(file.type)) {
                dispatch("error", {
                    type: "type",
                    message: `File type ${file.type} not allowed`,
                    file,
                });
                return;
            }

            value = file;
            dispatch("fileSelected", { file });
            // Also emit a generic change event for integrators (e.g., AutoForm)
            dispatch("change", { value: file });
        }
    }

    function handleInputChange(event) {
        handleFileSelect(event.target.files);
    }

    function handleDragOver(event) {
        event.preventDefault();
        isDragOver = true;
    }

    function handleDragLeave(event) {
        event.preventDefault();
        isDragOver = false;
    }

    function handleDrop(event) {
        event.preventDefault();
        isDragOver = false;
        handleFileSelect(event.dataTransfer.files);
    }

    function clearFile() {
        value = multiple ? [] : null;
        if (fileInput) fileInput.value = "";
        dispatch("fileCleared");
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }
</script>

<div class="file-upload-wrapper {customClass}">
    <label class="form-label">
        {label}
        {#if required}
            <span class="text-danger">*</span>
        {/if}
    </label>

    <div
        class="file-upload-zone {isDragOver ? 'drag-over' : ''} {errors.length >
        0
            ? 'is-invalid'
            : ''}"
        role="button"
        tabindex="0"
        onclick={() => fileInput?.click()}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInput?.click();
            }
        }}
    >
        <input
            bind:this={fileInput}
            type="file"
            {accept}
            {multiple}
            {disabled}
            style="display: none;"
            onchange={handleInputChange}
        />

        <div class="file-upload-content">
            {#if value && ((Array.isArray(value) && value.length > 0) || !Array.isArray(value))}
                <div class="file-selected">
                    <i class="bi bi-file-earmark-check text-success me-2"></i>
                    <span class="file-name">{displayName}</span>
                    {#if value instanceof File}
                        <small class="text-muted ms-2"
                            >({formatFileSize(value.size)})</small
                        >
                    {:else if Array.isArray(value) && value.length === 1}
                        <small class="text-muted ms-2"
                            >({formatFileSize(value[0].size)})</small
                        >
                    {/if}
                    <button
                        type="button"
                        class="btn btn-sm btn-outline-danger ms-2"
                        onclick={(e) => {
                            e.stopPropagation();
                            clearFile();
                        }}
                        {disabled}
                    >
                        <i class="bi bi-x"></i>
                    </button>
                </div>
            {:else}
                <div class="file-upload-prompt">
                    <i class="bi bi-cloud-upload text-muted mb-2"></i>
                    <div class="upload-text">
                        <strong>Click to upload</strong> or drag and drop
                    </div>
                    <small class="text-muted">{placeholder}</small>
                </div>
            {/if}
        </div>

        {#if isUploading}
            <div class="upload-progress">
                <div class="progress">
                    <div
                        class="progress-bar"
                        role="progressbar"
                        style="width: {uploadProgress}%"
                        aria-valuenow={uploadProgress}
                        aria-valuemin="0"
                        aria-valuemax="100"
                    ></div>
                </div>
                <small class="text-muted">Uploading... {uploadProgress}%</small>
            </div>
        {/if}
    </div>

    {#if errors.length > 0}
        <div class="invalid-feedback d-block">
            {errors.join(", ")}
        </div>
    {/if}
</div>

<style>
    .file-upload-zone {
        border: 2px dashed #dee2e6;
        border-radius: 0.375rem;
        padding: 2rem;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s ease;
        background-color: #f8f9fa;
    }

    .file-upload-zone:hover {
        border-color: #0d6efd;
        background-color: #e7f3ff;
    }

    .file-upload-zone.drag-over {
        border-color: #0d6efd;
        background-color: #e7f3ff;
        transform: scale(1.02);
    }

    .file-upload-zone.is-invalid {
        border-color: #dc3545;
    }

    .file-upload-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }

    .file-selected {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-wrap: wrap;
        gap: 0.25rem;
    }

    .file-name {
        font-weight: 500;
        word-break: break-all;
        max-width: 300px;
    }

    .file-upload-prompt {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }

    .file-upload-prompt i {
        font-size: 2rem;
    }

    .upload-progress {
        margin-top: 1rem;
        width: 100%;
        max-width: 300px;
    }

    .upload-text {
        font-size: 1rem;
    }

    @media (max-width: 576px) {
        .file-upload-zone {
            padding: 1rem;
        }

        .file-upload-prompt i {
            font-size: 1.5rem;
        }
    }
</style>
