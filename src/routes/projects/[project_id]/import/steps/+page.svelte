<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Datasource from "$lib/components/import/Datasource.svelte";
  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
  $inspect(data);
</script>

{#if wizard.currentStep === 1}
  <Datasource institutions={data.institutions} languages={data.languages} />
{/if}
