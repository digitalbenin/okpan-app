<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";

  const { template } = $props();
  const { t, translationState } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

{#if template?.datasources && template.datasources.length > 0}
  <div class="d-flex align-items-center border rounded p-2 bg-white mb-1 gap-2">
    <div class="text-truncate fw-bold">
      {template.datasources[0].name?.content ?? "Unknown"}
    </div>
    <div>
      {formatDate(
        +(template.datasources[0].date ?? 0),
        translationState.currentLocale
      )}
    </div>
    <div class="ms-auto">
      <button
        class="btn btn-success"
        onclick={() => {
          wizard.reusedTemplate = $state.snapshot(template);
          wizard.mapping = $state.snapshot(template.mapping);
          wizard.useMatchingTemplate = true;
        }}
      >
        {t("import.reuse", {
          fallback: "Reuse",
        })}
      </button>
    </div>
  </div>
{/if}
