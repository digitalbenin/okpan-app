<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  const { t } = getTranslationStore();
  const { data } = $props();

  let isExporting = $state(false);
  let exportResult = $state(null);
  let exportError = $state(null);

  async function handleExportProjectFile() {
    isExporting = true;
    exportError = null;
    exportResult = null;

    try {
      const result = await window.api.createBackup({
        project_id: data.project.id,
      });

      if (result.canceled) {
        exportResult = null;
      } else {
        exportResult = result;
      }
    } catch (error) {
      console.error("Error exporting project file:", error);
      exportError = error.message;
    } finally {
      isExporting = false;
    }
  }
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col-12">
      <div class="d-flex justify-content-between align-items-center pt-3 pb-2 mb-3">
        <h1 class="h2">
          {t("menu.sharing")}
        </h1>
      </div>

      <!--<p class="text-muted">
        {t("settings.sharing_description", {
          fallback: "This is a multi-user project. Share the link below with anyone you want to invite.",
        })}
      </p>-->

      <!-- Project file section -->
      <div class="mt-4">
        <h6>{t("settings.project_file")}</h6>
        
        <div class="mt-3">
          <BaseButton
            text={t("settings.export_project_file")}
            icon="download"
            iconPosition="left"
            onClick={handleExportProjectFile}
            disabled={isExporting}
            class="btn btn-primary"
          />
        </div>

        {#if isExporting}
          <div class="mt-3">
            <div class="d-flex align-items-center">
              <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">{t("common.loading")}</span>
              </div>
              {t("settings.exporting")}
            </div>
          </div>
        {/if}

        {#if exportResult}
          <div class="alert alert-success mt-3">
            <strong>{t("common.success")}</strong>
            <p class="mb-0">
              {t("settings.export_success_message")}
            </p>
            <small class="text-muted">
              {t("settings.file_location", { path: exportResult.filePath })}
            </small>
            <div class="mt-2">
              <small>
                {t("settings.backup_counts", {
                  objects: exportResult.metadata.counts.objects,
                  assets: exportResult.copiedAssets,
                })}
              </small>
            </div>
          </div>
        {/if}

        {#if exportError}
          <div class="alert alert-danger mt-3">
            <strong>{t("common.error")}</strong>
            <p class="mb-0">{exportError}</p>
          </div>
        {/if}

        <p class="text-muted mt-3">
          {t("settings.import_instruction")}
        </p>
      </div>
    </div>
  </div>
</div>
