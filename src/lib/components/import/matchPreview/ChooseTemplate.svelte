<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import TemplatePreview from "./TemplatePreview.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { templateSuggestions } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div class="bg-light p-3 border rounded">
  <div class="mb-2">
    {t("import.match-template-reuse", {
      fallback: "We found some mappings that might match your data structure.",
    })}
  </div>

  {#each templateSuggestions as template}
    <TemplatePreview {template} />
  {/each}
  <div class="mt-3">
    <button
      class="btn btn-secondary"
      onclick={() => {
        wizard.useMatchingSuggestions = true;
      }}
    >
      {t("import.new-template", {
        fallback: "No, I want to create a new mapping",
      })}
    </button>
  </div>
</div>
