<script>
  import TablePreview from "./TablePreview.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getMediaType } from "$lib/utils/media.js";
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  let files = $state(wizard.selectedFiles || []);
  let filesSelected = $state(wizard.selectedFilePaths || []);
  let importErrors = $state([]);

  function buildPendingAssets(selectedPaths) {
    const byPath = new Map((files || []).map((file) => [file.path, file]));
    return (selectedPaths || []).map((filePath) => {
      const file = byPath.get(filePath);
      const mediaType = getMediaType(file?.name || filePath);
      return {
        id: `tmp:${filePath}`,
        filename: file?.name || filePath.split(/[/\\]/).pop(),
        type: mediaType,
        path: filePath,
        formats: mediaType === 'image'
          ? { original: filePath, sm: filePath, md: filePath }
          : { original: filePath },
        _sourcePath: filePath,
      };
    });
  }

  $effect(() => {
    wizard.selectedFiles = files;
    wizard.selectedFilePaths = filesSelected;
    wizard.assets = buildPendingAssets(filesSelected);
    wizard.mapping = [];
    wizard.nextEnabled = filesSelected.length > 0;
    wizard.hasPersistedAssets = false;
  });

  async function choose(isDirectory) {
    const result = await window.api.openFileDialog({
      isDirectory,
      multiple: !isDirectory,
    });
    console.log("Dialog result", result);
    if (result.canceled) return;
    wizard.assets = [];
    wizard.mapping = [];
    wizard.hasPersistedAssets = false;
    importErrors = [];
    files = result.files;
    filesSelected = result.files.map((f) => f.path);
  }
</script>

<div class="container-fluid pt-3 h-100 d-flex flex-column">
  <div class="row">
    <div class="col-12">
      <h2 class="mt-3">
        {t("common.select-files", { fallback: "Select Files to import" })}
      </h2>
      <p>
        {t("common.select-file-desc", {
          fallback:
            "You can upload file images in different formats such as .png, .jpg, .webp, .avif.",
        })}
      </p>
    </div>
  </div>
  <div class="row mb-3">
    <div class="col-12">
      <button class="btn btn-primary" onclick={() => choose(false)}>
        <i class="bi bi-files"></i>
        {t("import.select-files", { fallback: "Select Files" })}
      </button>

      <button class="btn btn-primary" onclick={() => choose(true)}>
        <i class="bi bi-folder"></i>
        {t("import.select-directory", { fallback: "Select Directory" })}
      </button>
    </div>
  </div>
  {#if files.length}
    <div class="d-flex flex-column flex-grow-1 min-h-0">
      <div class="row flex-grow-1 min-h-0 overflow-y-auto">
        <div class="col-9 h-100 d-flex flex-column">
          <div class="flex-grow-1 min-h-0 overflow-y-auto">
            <TablePreview
              data={files.map((f) => ({ name: f.name, size: f.size, id: f.path }))}
              bind:selected={filesSelected}
            />
          </div>

          {#if importErrors.length}
            <div class="alert alert-danger mt-2 mb-0">
              <h4>
                {t("import.errors-occurred", {
                  fallback: "Some errors occurred",
                })}
              </h4>
              <ul>
                {#each importErrors as err}
                  <li>{err}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      </div>
      <div class="row bg-white border-top py-2 position-sticky bottom-0 z-3 mt-2">
        <div class="col-12 d-flex align-items-center justify-content-end gap-3">
          {#if files.length}
            <span>
              {filesSelected.length}
              {filesSelected.length === 1
                ? t("import.file-selected", { fallback: "file selected" })
                : t("import.files", { fallback: "files selected" })}
            </span>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
