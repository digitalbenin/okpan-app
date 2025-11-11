<script>
  import { addImageProtocolPrefix, MEDIA_EXTENSIONS, MEDIA_MIME_TYPES } from "$lib/utils/media.js";

  let {
    value = $bindable(null),
    accept = "image/*",
    placeholder = "Choose image...",
    multiple = false, // kept for API parity; only single image used
    required = false,
    class: customClass = "",
    errors = [],
    disabled = false,
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = MEDIA_MIME_TYPES.image,
    // Optional callback for integration with form libraries
    onChange = null,
  } = $props();

  let isDragOver = $state(false);

  const displayName = $derived.by(() => {
    if (!value || value?.__cleared) return placeholder;
    const name = value?.name || value?.filename || null;
    if (name) return name;
    if (typeof value === "string") return value.split("/").pop() || value;
    return placeholder;
  });

  const previewPath = $derived.by(() => {
    if (!value || value.__cleared) return null;
    if (typeof value === "string") return value;
    // Support saved asset objects with formats and path
    const formats = value?.formats || {};
    return formats.sm || formats.md || formats.original || value?.path || null;
  });

  const hasPreview = $derived(Boolean(previewPath));

  async function openDialog() {
    if (disabled) return;
    try {
      const result = await window.api.openFileDialog({
        title: "Select Image",
        multiple: false,
        filters: [
          {
            name: "Images",
            extensions: MEDIA_EXTENSIONS.image,
          },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (result?.canceled) return;
      // Support both legacy { filePaths: [] } and current { files: [{ path, name, size }] }
      const files = Array.isArray(result?.files) ? result.files : [];
      const filePath =
        files?.[0]?.path ||
        (Array.isArray(result?.filePaths) ? result.filePaths?.[0] : undefined);
      const fileName =
        files?.[0]?.name ||
        (typeof filePath === "string"
          ? filePath.split(/[\/\\]/).pop()
          : undefined);
      if (!filePath) return;
      console.log("[FileUpload]", "selected via dialog", filePath);
      value = {
        path: filePath,
        name: fileName,
        type: "file",
      };
      console.log("[FileUpload]", "value", value);
      if (typeof onChange === "function") onChange(value);
    } catch (e) {
      console.error("File dialog error:", e);
    }
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
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    // Use the first file only (image)
    const file = files[0];
    // Validate file size
    if (maxSize && file.size > maxSize) {
      return;
    }
    // Validate file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return;
    }
    // Electron provides File.path
    console.log("[FileUpload]", "dropped", {
      name: file.name,
      path: file.path,
      type: file.type,
      size: file.size,
    });
    value = {
      path: file.path || undefined,
      name: file.name,
      type: file.type || "file",
      size: file.size,
    };
    console.log("[FileUpload]", "value", value);
    if (typeof onChange === "function") onChange(value);
  }

  function clearFile() {
    value = null;
    console.log("[FileUpload]", "cleared -> value set to null");
    if (typeof onChange === "function") onChange(value);
  }
</script>

<div class={`${customClass}`}>
  <div
    class={`d-block p-3 rounded ${hasPreview
      ? "bg-transparent"
      : (isDragOver
        ? "bg-primary-subtle border border-2 border-primary"
        : "bg-light border border-2 border-secondary")}
      ${!hasPreview && errors.length > 0 ? "border-danger" : ""}`}
    role="button"
    tabindex="0"
    onclick={openDialog}
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    onkeydown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDialog();
      }
    }}
  >
    <div
      class={hasPreview
        ? "d-flex flex-column align-items-start gap-2"
        : "d-flex flex-column align-items-center gap-2"}
    >
      {#if hasPreview}
        <div class="position-relative d-inline-block">
          <img
            src={addImageProtocolPrefix(
              String(previewPath).replace(/\\/g, "/"),
            )}
            alt={displayName}
            class="img-thumbnail img-fluid"
            loading="lazy"
          />
          <button
            type="button"
            aria-label="Remove image"
            class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 m-0"
            onclick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            {disabled}
            title="Remove image"
          >
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="mt-2 text-muted small">{displayName}</div>
      {:else}
        <div class="text-center">
          <i class="bi bi-cloud-upload text-muted mb-2"></i>
          <div>
            <strong>Click to upload</strong> or drag and drop
          </div>
          <small class="text-muted">{placeholder}</small>
        </div>
      {/if}
    </div>
  </div>

  {#if errors.length > 0}
    <div class="invalid-feedback d-block">
      {errors.join(", ")}
    </div>
  {/if}
</div>
