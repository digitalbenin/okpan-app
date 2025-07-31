<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Datasource from "$lib/components/import/Datasource.svelte";
  import UploadFile from "$lib/components/import/UploadFile.svelte";
  import MatchFields from "$lib/components/import/MatchFields.svelte";
  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
  $inspect(data);
</script>

{#if wizard.currentStep === 1}
  <Datasource institutions={data.institutions} languages={data.languages} />
{/if}

{#if wizard.currentStep === 2}
  <UploadFile />
{/if}

{#if wizard.currentStep === 3}
  <MatchFields />
{/if}
