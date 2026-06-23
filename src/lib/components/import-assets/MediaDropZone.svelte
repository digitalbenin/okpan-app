<script>
  import { IconUpload } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { MEDIA_EXTENSIONS } from "$lib/utils/media.js";

  let {
    onSelect = async () => {},
  } = $props();

  const { t } = getTranslationStore();

  let isDragOver = $state(false);

  const formatChips = $derived([
    ...(MEDIA_EXTENSIONS.image || []).map((e) => e.toUpperCase())
  ]);

  const acceptedExts = $derived([
    ...(MEDIA_EXTENSIONS.image || [])
  ]);

  function isAccepted(filePath) {
    const ext = (filePath.split(".").pop() || "").toLowerCase();
    return acceptedExts.includes(ext);
  }

  async function handleClick() {
    try {
      const result = await window.api.openFileDialog({
        isDirectory: false,
        multiple: true,
      });
      if (result?.canceled || !result?.files?.length) return;
      const paths = result.files.map((f) => f.path).filter(isAccepted);
      if (paths.length) await onSelect(paths);
    } catch (err) {
      console.error("Failed to pick files", err);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
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
    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    const paths = droppedFiles
      .map((f) => {
        try { return window.api.getPathForFile(f); } catch { return null; }
      })
      .filter(Boolean)
      .filter(isAccepted);

    if (paths.length) await onSelect(paths);
  }
</script>

<div
  class="w-100 rounded-4 d-flex flex-column align-items-center justify-content-center gap-3 py-5 px-3 text-center"
  role="button"
  tabindex="0"
  style="border: 2px dashed {isDragOver ? 'var(--bs-primary)' : 'var(--bs-gray-400)'}; cursor: pointer; transition: border-color 0.15s ease;"
  onclick={handleClick}
  onkeydown={handleKeyDown}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  <IconUpload size={24} class="text-body-secondary" />
  <div>
    <p class="fw-semibold mb-1 text-body-secondary">
      {t("import-assets.click-to-select-file", { fallback: "Click to select a file" })}
    </p>
    <p class="text-body-secondary small mb-2">
      {t("import-assets.or-drag-and-drop", { fallback: "Or drag and drop here" })}
    </p>
    <div class="d-flex gap-2 justify-content-center">
      {#each formatChips as ext}
        <span class="badge fw-normal text-bg-secondary border">{ext}</span>
      {/each}
    </div>
  </div>
</div>
