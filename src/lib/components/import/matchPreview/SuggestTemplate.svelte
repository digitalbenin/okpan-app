<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";

  const { templateSuggestions } = $props();
  const { t, translationState } = getTranslationStore();
  const wizard = getImportWizardContext();

  const firstTemplate = $derived(templateSuggestions.current?.[0]);
  const templateName = $derived(firstTemplate?.datasources?.[0]?.name?.content);
  const templateDate = $derived(firstTemplate?.datasources?.[0]?.date);

  const showDecision = $derived(
    !templateSuggestions.loading &&
    templateSuggestions.current.length > 0 &&
    !wizard.useMatchingTemplate &&
    !wizard.useMatchingSuggestions &&
    wizard.mapping.filter((m) => m.mappedField != null).length === 0
  );

  function acceptTemplate() {
    wizard.reusedTemplate = firstTemplate;
    wizard.mapping = firstTemplate.mapping;
    wizard.useMatchingTemplate = true;
  }

  function declineTemplate() {
    wizard.useMatchingSuggestions = true;
  }
</script>

{#if showDecision}
  <div class="p-0">
    <div class="mb-3 d-flex gap-2">
      <span>{t("import.template-colon", { fallback: "Template:" })}</span>
      <span class="fw-semibold">{templateName} ({formatDate(+templateDate, translationState.currentLocale)})</span>
    </div>
    <div class="d-flex gap-2">
      <button class="btn btn-success btn-sm" onclick={acceptTemplate}>
        {t("import.reuse-this-template", { fallback: "Reuse this template" })}
      </button>
      <button class="btn btn-secondary btn-sm" onclick={declineTemplate}>
        {t("import.create-new-mapping", { fallback: "No, I want to create a new mapping" })}
      </button>
    </div>
  </div>
{/if}
