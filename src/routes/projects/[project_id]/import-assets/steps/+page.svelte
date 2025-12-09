<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import Institution from "$lib/components/import-assets/Institution.svelte";
  // import Datasource from "$lib/components/import/Datasource.svelte";
  import UploadAssets from "$lib/components/import-assets/UploadAssets.svelte";
  import MatchAssets from "$lib/components/import-assets/MatchAssets.svelte";
  // import MatchFields from "$lib/components/import/MatchFields.svelte";
  // import Identifier from "$lib/components/import/Identifier.svelte";
  import ReviewSave from "$lib/components/import-assets/ReviewSave.svelte";
  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();
</script>

{#if wizard.currentStep === 1}
  <Institution institutions={data.institutions} />
{/if}

{#if wizard.currentStep === 2}
  <UploadAssets />
{/if}

{#if wizard.currentStep === 3}
  <MatchAssets ontologyFields={data.ontologyFields?.result || data.ontologyFields || []} />
{/if}

{#if wizard.currentStep === 4}
  <ReviewSave />
{/if}
