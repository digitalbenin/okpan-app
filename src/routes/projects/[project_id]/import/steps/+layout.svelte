<script>
  import Steps from "$lib/components/import/Steps.svelte";
  import BottomToolbar from "$lib/components/import/BottomToolbar.svelte";
  import { createImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { children } = $props();
  const wizard = createImportWizardContext();
</script>

<Steps />
{@render children()}
<BottomToolbar />
