<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import TablePreview from "./TablePreview.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  let files = $state([]);
  let filesSelected = $state([]);

  async function choose(isDirectory) {
    const result = await window.api.openFileDialog({
      isDirectory,
      multiple: !isDirectory,
    });
    console.log("Dialog result", result);
    if (result.canceled) return;
    files = result.filePaths;
    filesSelected = result.filePaths;
  }

  async function importNow() {
    const payload = {
      path: $state.snapshot(filesSelected),
      isDirectory: false,
      projectId: wizard.projectId,
      institutionId: wizard.institutionId,
    };

    console.log("Importing with payload", payload);

    const { errors, createdAssets } = await window.api.importAssets(payload);
    if (errors?.length) console.warn("Import warnings", errors);

    wizard.assets = createdAssets ? createdAssets : [];
  }

  $inspect(wizard);
</script>

<div class="container-fluid mt-3">
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
    <div class="row">
      <div class="col-12">
        <TablePreview
          data={files.map((f) => ({ path: f, id: f }))}
          bind:selected={filesSelected}
        />

        <div class="d-flex align-items-center">
          {filesSelected.length}
          {filesSelected.length === 1
            ? t("import.file-selected", { fallback: "file selected" })
            : t("import.files", { fallback: "files selected" })}
          <button
            class="ms-2 btn btn-success"
            disabled={filesSelected.length === 0}
            onclick={importNow}
          >
            {t("import.import", { fallback: "Import" })}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

{#if wizard.assets.length}
  <div class="row g-3 mt-3">
    {#each wizard.assets as a}
      <div class="col-3">
        <img
          src={`media://${a.path}`}
          alt={a.filename}
          style="width:100%;aspect-ratio:1;object-fit:cover;"
        />
      </div>
    {/each}
  </div>
{/if}
