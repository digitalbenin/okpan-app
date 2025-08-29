<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import ChooseTemplate from "./chooseTemplate.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { templateSuggestions } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

{#if !templateSuggestions.loading && templateSuggestions.current.length > 0 && !wizard.useMatchingTemplate && !wizard.useMatchingSuggestions && wizard.mapping.length === 0}
  <ChooseTemplate templateSuggestions={templateSuggestions.current} />
{/if}
{#if wizard.useMatchingTemplate}
  <div class="d-flex align-items-center mb-2 gap-2">
    <button
      class="btn btn-primary btn-sm"
      onclick={() => {
        wizard.useMatchingTemplate = false;
      }}
    >
      {t("import.enable-edit", {
        fallback: "Enable Edit",
      })}
    </button>
    <div>
      {t("import.reusing-template", {
        fallback: "Reusing mapping from ",
      })}
      <span class="fst-italic"
        >{wizard.reusedTemplate.datasources[0].name.content}</span
      >
    </div>
  </div>
{/if}
