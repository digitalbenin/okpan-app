<script>
  import Steps from "$lib/components/import/Steps.svelte";
  import BottomToolbar from "$lib/components/import/BottomToolbar.svelte";
  import { createImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { onDestroy } from "svelte";
  import { deleteDatasource } from "$lib/api/DatasourcesApi.js";
  import DirtyNavigationGuard from "$lib/components/navigation/DirtyNavigationGuard.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { data, children } = $props();
  const { t } = getTranslationStore();
  const wizard = createImportWizardContext({ projectId: data.project.id });

  const dirtyTracker = {
    get isDirty() {
      return !wizard.importCompleted && (
        wizard.currentStep > 1 ||
        Boolean(wizard.datasourceId) ||
        (wizard.data?.length || 0) > 0 ||
        (wizard.mapping?.length || 0) > 0 ||
        Boolean(wizard.file)
      );
    }
  };

  onDestroy(() => {
    if (!wizard.importCompleted && wizard.datasourceId) {
      deleteDatasource(wizard.datasourceId)
        .catch((err) => console.warn("[Import] Failed to delete datasource on abort", err))
        .finally(() => {
          wizard.datasourceId = null;
        });
    }
  });
</script>

<div class="h-100 d-flex flex-column">
  <Steps />
  <div class="flex-grow-1 overflow-y-auto">
    {@render children?.()}
  </div>
  <BottomToolbar />
</div>

<DirtyNavigationGuard
  {dirtyTracker}
  enabled={!wizard.importCompleted}
  title={t("import.import-not-completed-title")}
  message={t("import.import-not-completed-message")}
  confirmText={t("common.leave")}
  cancelText={t("common.stay")}
/>
