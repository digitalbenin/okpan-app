<script>
  import { IconX } from "@tabler/icons-svelte";
  import { addImageProtocolPrefix, MEDIA_EXTENSIONS, MEDIA_MIME_TYPES } from "$lib/utils/media.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    value = $bindable(null),
    placeholder = "",
    class: customClass = "",
    errors = [],
    disabled = false,
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = MEDIA_MIME_TYPES.image,
    // Optional callback for integration with form libraries
    onChange = null,
  } = $props();

  let isDragOver = $state(false);
  const { t } = getTranslationStore();
  const resolvedPlaceholder = $derived(placeholder || t("file-upload.choose-image"));

  const displayName = $derived.by(() => {
    if (!value || value?.__cleared) return resolvedPlaceholder;
    const name = value?.name || value?.filename || null;
    if (name) return name;
    if (typeof value === "string") return value.split("/").pop() || value;
    return resolvedPlaceholder;
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
        title: t("file-upload.select-image"),
        multiple: false,
        filters: [
          {
            name: t("file-upload.images"),
            extensions: MEDIA_EXTENSIONS.image,
          },
          { name: t("file-upload.all-files"), extensions: ["*"] },
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
    class={`d-block p-4 rounded-3 upload-pane ${hasPreview
      ? "bg-transparent has-preview"
      : (isDragOver
        ? ""
        : "border-secondary-subtle")}
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
            aria-label={t("media.remove-image")}
            class="btn btn-danger btn-sm rounded-circle position-absolute top-0 end-0 m-0"
            style="width: 32px; height: 32px; padding: 0;"
            onclick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            {disabled}
            title={t("media.remove-image")}
          >
            <IconX size={14} />
          </button>
        </div>
        <div class="mt-2 text-muted small">{displayName}</div>
      {:else}
        <div class="text-center py-5">
          <div class="fs-5 mb-0">
            {t("file-upload.drag-file-here-or")} <button
              type="button"
              class="btn btn-success mx-1"
              onclick={(e) => {
                e.stopPropagation();
                openDialog();
              }}
            >{t("file-upload.browse")}</button> {t("file-upload.file-from-your-computer")}
          </div>
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
<style>
  .upload-pane {
    border-style: dashed;
    
  }
  .upload-pane img {
    max-height: 300px;
    object-fit: contain;

  }
  .upload-pane.has-preview {
    border: none;
    padding: 0 !important;
    margin: 0;
    width:fit-content;
  }
 
</style>