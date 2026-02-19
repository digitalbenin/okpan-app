<script>
  import { goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  function onCancel() {
    goto(`/projects/${wizard.projectId}`);
  }
</script>

<button class="btn btn-outline-secondary" onclick={onCancel}>
  {t("import.cancel", { fallback: "Cancel" })}
</button>
