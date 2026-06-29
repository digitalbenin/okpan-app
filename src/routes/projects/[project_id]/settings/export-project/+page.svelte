<script>
  import { IconSettings, IconDownload, IconInfoCircle } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";

  const { t } = getTranslationStore();
  const { data } = $props();
  const project = $derived(data.project);

  let isExporting = $state(false);
  let exportResult = $state(null);
  let exportError = $state(null);

  async function handleExportProjectFile() {
    isExporting = true;
    exportError = null;
    exportResult = null;
    try {
      const result = await window.api.createBackup({ project_id: project.id });
      exportResult = result.canceled ? null : result;
    } catch (error) {
      console.error("Error exporting project file:", error);
      exportError = error.message;
    } finally {
      isExporting = false;
    }
  }

  const rightActionButtons = $derived([
    {
      id: "export-project-file",
      text: isExporting ? t("common.saving", { fallback: "Saving..." }) : t("settings.export_project_file", { fallback: "Export project file" }),
      class: "btn btn-success",
      iconComponent: IconDownload,
      disabled: isExporting,
      onClick: handleExportProjectFile,
      noSuccessFlash: true,
    },
  ]);
</script>



<PageActionFooter contentClass="container-fluid p-0 m-0" rightButtons={rightActionButtons}>
<!-- Heading section -->
<div class="bg-white border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4">
  <div class="d-flex flex-column gap-3">
    <div class="d-flex align-items-center gap-3">
      <div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
        <IconSettings size={32} />
      </div>
      <h1 class="mb-0 flex-grow-1">{t("menu.export-project", { fallback: "Export project" })}</h1>
    </div>
    <p class="mb-0" style="font-size: 14px;">{t("export-project.page-description", { fallback: "Saves your entire project as a single file." })}</p>
  </div>
</div>
  <div class="row g-3 mt-2">
    <div class="col-12 col-lg-8 col-xl-9 min-w-0">
      <div class="bg-white rounded-3 p-4">

        <div class="d-flex flex-column gap-1">
          <div class="flex-shrink-0">
            <IconInfoCircle size={16} stroke={2} />
          </div>
          <div>
            <p class="fw-semibold mb-1 text-body">{t("export-project.help-title", { fallback: "How to open it?" })}</p>
            <div class="text-body-secondary fs-7">
              <p class="mb-0">{t("export-project.help-desc", { fallback: "To reopen it, go to the Okpan home screen and select Import a project." })}</p>
            </div>
          </div>
        </div>

        {#if isExporting}
          <div class="mt-3">
            <div class="d-flex align-items-center">
              <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">{t("common.loading")}</span>
              </div>
              {t("settings.exporting", { fallback: "Creating backup..." })}
            </div>
          </div>
        {/if}

        {#if exportResult}
          <div class="alert alert-success mt-3">
            <strong>{t("common.success")}</strong>
            <p class="mb-0">{t("settings.export_success_message", { fallback: "Project backup created successfully." })}</p>
            <small class="text-muted">{t("settings.file_location", { path: exportResult.filePath })}</small>
            <div class="mt-2">
              <small>{t("settings.backup_counts", { objects: exportResult.metadata.counts.objects, assets: exportResult.copiedAssets })}</small>
            </div>
          </div>
        {/if}

        {#if exportError}
          <div class="alert alert-danger mt-3">
            <strong>{t("common.error")}</strong>
            <p class="mb-0">{exportError}</p>
          </div>
        {/if}

      </div>
    </div>

  </div>
</PageActionFooter>
