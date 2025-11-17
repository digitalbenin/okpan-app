<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import TablePreview from "./TablePreview.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  let files = $state([]);
  let filesSelected = $state([]);
  let importErrors = $state([]);
  let isImporting = $state(false);

  async function choose(isDirectory) {
    const result = await window.api.openFileDialog({
      isDirectory,
      multiple: !isDirectory,
    });
    console.log("Dialog result", result);
    if (result.canceled) return;
    wizard.assets = [];
    importErrors = [];
    files = result.files;
    filesSelected = result.files.map((f) => f.path);
  }

  async function importNow() {
    if (isImporting) return;
    isImporting = true;
    const payload = {
      path: $state.snapshot(filesSelected),
      isDirectory: false,
      projectId: wizard.projectId,
      institutionId: wizard.institutionId,
    };

    console.log("Importing with payload", payload);

    try {
      const { errors, createdAssets } = await window.api.importAssets(payload);
      importErrors = errors?.length ? errors : [];

      wizard.assets = createdAssets ? createdAssets : [];
      // wizard.assets = fakeAssets;
      if (wizard.assets.length) {
        wizard.nextEnabled = true;
      }
    } catch (error) {
      console.error("Import assets failed", error);
      importErrors = [error?.message || "Unknown error"];
    } finally {
      isImporting = false;
    }
  }

  const fakeAssets = [
    {
      id: "49666163-3fd0-49e4-8d05-8d57c15c9a82",
      created_at: "2025-09-12T08:34:01.000Z",
      updated_at: "2025-09-12T08:34:01.000Z",
      filename: "img_raf602.jpg",
      path: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/img_raf602_6aee54a2.avif",
      type: "image",
      formats: {
        sm: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/img_raf602_6aee54a2_sm.avif",
        md: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/img_raf602_6aee54a2_md.avif",
        original:
          "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/img_raf602_6aee54a2.avif",
      },
      properties: null,
      institution_id: "f0142078-d5b2-4ab3-98d0-3f489e3f0b08",
      project_id: "3e4cc3fb-11ee-4d0a-a999-df28a465fc28",
    },
    {
      id: "13507e4d-8de4-4739-a589-bec1250af127",
      created_at: "2025-09-12T08:34:01.000Z",
      updated_at: "2025-09-12T08:34:01.000Z",
      filename: "raf 603.jpg",
      path: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf 603_4a38448b.avif",
      type: "image",
      formats: {
        sm: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf 603_4a38448b_sm.avif",
        md: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf 603_4a38448b_md.avif",
        original:
          "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf 603_4a38448b.avif",
      },
      properties: null,
      institution_id: "f0142078-d5b2-4ab3-98d0-3f489e3f0b08",
      project_id: "3e4cc3fb-11ee-4d0a-a999-df28a465fc28",
    },
    {
      id: "dfdf2957-6a07-48ab-9909-a94039c8291a",
      created_at: "2025-09-12T08:34:04.000Z",
      updated_at: "2025-09-12T08:34:04.000Z",
      filename: "raf_602.jpg",
      path: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf_602_0683a0a1.avif",
      type: "image",
      formats: {
        sm: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf_602_0683a0a1_sm.avif",
        md: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf_602_0683a0a1_md.avif",
        original:
          "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/raf_602_0683a0a1.avif",
      },
      properties: null,
      institution_id: "f0142078-d5b2-4ab3-98d0-3f489e3f0b08",
      project_id: "3e4cc3fb-11ee-4d0a-a999-df28a465fc28",
    },
    {
      id: "8ee165fd-2577-4ba9-9d4b-ed55b0b74792",
      created_at: "2025-09-12T08:34:05.000Z",
      updated_at: "2025-09-12T08:34:05.000Z",
      filename: "3ddd7a3816a828b19cf2af9312d4a392ec87ba5a-5792x8688.jpg",
      path: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/3ddd7a3816a828b19cf2af9312d4a392ec87ba5a-5792x8688_6a434aa9.avif",
      type: "image",
      formats: {
        sm: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/3ddd7a3816a828b19cf2af9312d4a392ec87ba5a-5792x8688_6a434aa9_sm.avif",
        md: "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/3ddd7a3816a828b19cf2af9312d4a392ec87ba5a-5792x8688_6a434aa9_md.avif",
        original:
          "src/assets/project_assets/3e4cc3fb-11ee-4d0a-a999-df28a465fc28/3ddd7a3816a828b19cf2af9312d4a392ec87ba5a-5792x8688_6a434aa9.avif",
      },
      properties: null,
      institution_id: "f0142078-d5b2-4ab3-98d0-3f489e3f0b08",
      project_id: "3e4cc3fb-11ee-4d0a-a999-df28a465fc28",
    },
  ];
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
          data={files.map((f) => ({ name: f.name, size: f.size, id: f.path }))}
          bind:selected={filesSelected}
        />
        {#if !wizard.assets.length}
          <div class="d-flex align-items-center">
            {filesSelected.length}
            {filesSelected.length === 1
              ? t("import.file-selected", { fallback: "file selected" })
              : t("import.files", { fallback: "files selected" })}
            <button
              class="ms-2 btn btn-success d-flex align-items-center gap-2"
              disabled={filesSelected.length === 0 || isImporting}
              onclick={importNow}
            >
              {#if isImporting}
                <span
                  class="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
                <span>{t("import.importing", { fallback: "Importing..." })}</span>
              {:else}
                <span>{t("import.import", { fallback: "Import" })}</span>
              {/if}
            </button>
          </div>
        {/if}
        {#if wizard.assets.length}
          <div class="alert alert-success mt-3">
            {wizard.assets.length}
            {wizard.assets.length === 1
              ? t("import.asset-created", {
                  fallback: "asset imported correctly",
                })
              : t("import.assets-created", {
                  fallback: "assets imported correctly",
                })}
          </div>
        {/if}

        {#if importErrors.length}
          <div class="alert alert-danger">
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
  {/if}
</div>
