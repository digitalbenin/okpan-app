<script>
  import Steps from "$lib/components/import/Steps.svelte";
  import BottomToolbar from "$lib/components/import/BottomToolbar.svelte";
  import { createImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { data, children } = $props();
  const wizard = createImportWizardContext({ projectId: data.project.id });
</script>

<div class="h-100 d-flex flex-column">
  <Steps />
  <div class="flex-grow-1 overflow-y-auto">
    {@render children?.()}
  </div>
  <BottomToolbar />
</div>
