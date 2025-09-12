<script>
  import Steps from "$lib/components/import-assets/Steps.svelte";
  import BottomToolbar from "$lib/components/import-assets/BottomToolbar.svelte";
  import { createImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";

  const { data, children } = $props();
  const wizard = createImportAssetsWizardContext({
    projectId: data.project.id,
  });
</script>

<div class="h-100 d-flex flex-column">
  <Steps />
  <div class="flex-grow-1 overflow-y-auto">
    {@render children?.()}
  </div>
  <BottomToolbar />
</div>
