<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";

  const { template } = $props();
  const { t, translationState } = getTranslationStore();
  const wizard = getImportWizardContext();
  $inspect(template);
</script>

<div class="d-flex align-items-center border rounded p-2 bg-white mb-3 gap-2">
  <div class="text-truncate fw-bold">
    {template.datasources[0].name.content}
  </div>
  <div>
    {formatDate(+template.datasources[0].date, translationState.currentLocale)}
  </div>
  <div class="ms-auto">
    <button
      class="btn btn-primary"
      onclick={() => {
        wizard.reusedTemplate = template;
      }}
    >
      {t("import.reuse", {
        fallback: "Reuse",
      })}
    </button>
  </div>
</div>
