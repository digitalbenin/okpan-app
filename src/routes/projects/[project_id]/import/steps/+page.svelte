<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { queryParameters, ssp } from "sveltekit-search-params";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Datasource from "$lib/components/import/Datasource.svelte";
  import UploadFile from "$lib/components/import/UploadFile.svelte";
  import MatchFields from "$lib/components/import/MatchFields.svelte";
  import Identifier from "$lib/components/import/Identifier.svelte";
  import ReviewSave from "$lib/components/import/ReviewSave.svelte";
  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
  const params = queryParameters({ institution_id: ssp.string(undefined) });
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

{#if wizard.currentStep === 4}
  <Identifier ontologyFields={data.ontologyFields} />
{/if}

{#if wizard.currentStep === 5}
  <ReviewSave />
{/if}
