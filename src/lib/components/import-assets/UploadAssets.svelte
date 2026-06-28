<script>
  import { IconFiles, IconFolder, IconBulb } from "@tabler/icons-svelte";
  import TablePreview from "./TablePreview.svelte";
  import MediaDropZone from "./MediaDropZone.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getMediaType } from "$lib/utils/media.js";
  import { watch } from "runed";
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  let files = $state(wizard.selectedFiles || []);
  let filesSelected = $state(wizard.selectedFilePaths || []);
  let importErrors = $state([]);
  let includeSubfolders = $state(true);

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

  watch(
    () => [files, filesSelected],
    () => {
      wizard.selectedFiles = files;
      wizard.selectedFilePaths = filesSelected;
      wizard.assets = buildPendingAssets(filesSelected);
      wizard.mapping = [];
      wizard.nextEnabled = filesSelected.length > 0;
      wizard.hasPersistedAssets = false;
    },
    { immediate: true },
  );

  async function choose(isDirectory) {
    const result = await window.api.openFileDialog({
      isDirectory,
      multiple: !isDirectory,
      recursive: isDirectory ? includeSubfolders : undefined,
    });
    if (result.canceled) return;
    wizard.assets = [];
    wizard.mapping = [];
    wizard.hasPersistedAssets = false;
    importErrors = [];
    files = result.files;
    filesSelected = result.files.map((f) => f.path);
  }

  function handleDropZoneSelect(paths) {
    const mappedFiles = paths.map((p) => ({ name: p.split(/[/\\]/).pop(), path: p, size: 0 }));
    wizard.assets = [];
    wizard.mapping = [];
    wizard.hasPersistedAssets = false;
    importErrors = [];
    files = mappedFiles;
    filesSelected = paths;
  }
</script>

<div class="row g-3">
  <!-- Left column: main content -->
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
    <div class="bg-white rounded-3 p-4 d-flex flex-column gap-4">
      <div>
        <h3 class="mb-1">
          {t("import-assets.select-files-title", { fallback: "Select files to import" })}
        </h3>
        <p class="mb-0 text-body-secondary">
          {t("import-assets.select-files-desc", {
            fallback: "You can upload file images in different formats such as .png, .jpg, .webp, .avif.",
          })}
        </p>
      </div>

      <div class="d-flex gap-2">
        <button class="btn btn-secondary" onclick={() => choose(false)}>
          <IconFiles size={16} class="me-1" />
          {t("import-assets.select-files-btn", { fallback: "Select files" })}
        </button>
        <button class="btn btn-secondary" onclick={() => choose(true)}>
          <IconFolder size={16} class="me-1" />
          {t("import-assets.select-directory-btn", { fallback: "Select directory" })}
        </button>
        <label class="form-check-label d-flex align-items-center gap-1 ms-2">
          <input type="checkbox" class="form-check-input" bind:checked={includeSubfolders} />
          <span class="fs-7">{t("import-assets.include-subfolders", { fallback: "Include subfolders" })}</span>
        </label>
      </div>

      {#if !files.length}
        <MediaDropZone onSelect={handleDropZoneSelect} />
      {/if}

      {#if files.length}
        <div>
          <TablePreview
            data={files.map((f) => ({ name: f.name, size: f.size, id: f.path }))}
            bind:selected={filesSelected}
          />
        </div>

        {#if importErrors.length}
          <div class="alert alert-danger mt-2 mb-0">
            <h4>
              {t("common.errors-occurred", {
                fallback: "Some errors occurred:",
              })}
            </h4>
            <ul>
              {#each importErrors as err}
                <li>{err}</li>
              {/each}
            </ul>
          </div>
        {/if}

        
      {/if}
    </div>
  </div>

  <!-- Right column: info sidebar -->
  <div class="col-12 col-lg-4 col-xl-3">
    <div class="bg-white border rounded-3 p-4">
      <div class="d-flex flex-column gap-3">
        <div class="flex-shrink-0">
          <IconBulb size={16} stroke={2} />
        </div>
        <div>
          <p class="fw-semibold mb-1 text-body">
            {t("import-assets.upload-help-title", { fallback: "Which images do you want to import?" })}
          </p>
          <div class="text-body-secondary fs-7">
            <p class="mb-0">
              {t("import-assets.upload-help-desc", {
                fallback: "Select the image files you want to import from your computer. You can select multiple files at once. Instead of uploading images one by one on each object page, this process lets Okpan match and link them automatically based on their filenames.",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
