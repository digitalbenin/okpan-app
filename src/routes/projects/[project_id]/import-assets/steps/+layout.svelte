<script>
  import Steps from "$lib/components/import-assets/Steps.svelte";
  import BottomToolbar from "$lib/components/import-assets/BottomToolbar.svelte";
  import { createImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import DirtyNavigationGuard from "$lib/components/navigation/DirtyNavigationGuard.svelte";

  const { data, children } = $props();
  const wizard = createImportAssetsWizardContext({
    projectId: data.project.id,
  });

  if (data.initialInstitutionId) {
    wizard.institutionId = data.initialInstitutionId;
    wizard.currentStep = 2;
    wizard.nextEnabled = false;
  }

  const dirtyTracker = {
    get isDirty() {
      return !wizard.importCompleted && (
        wizard.currentStep > 1 ||
        Boolean(wizard.institutionId) ||
        (wizard.assets?.length || 0) > 0 ||
        (wizard.mapping?.length || 0) > 0
      );
    }
  };
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
  title="Import not completed"
  message="The import process is not completed. Are you sure you want to leave?"
  confirmText="Leave"
  cancelText="Stay"
/>
