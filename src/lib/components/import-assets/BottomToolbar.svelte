<script>
  import Cancel from "./Cancel.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();
  const assetCount = $derived(wizard.assets?.length || 0);
</script>

<div
  class="w-100 bg-white mb-n4 px-4 py-3 d-flex justify-content-between align-items-center"
>
  <div class="d-flex gap-2">
    <Cancel />
    {#if wizard.currentStep > 1}
      <button
        class="btn btn-outline-secondary"
        onclick={wizard.goBackOneStep}
        disabled={wizard.isCleaningUp}
      >
        {t("common.back", { fallback: "Back" })}
      </button>
    {/if}
  </div>
  <div class="text-primary fw-bold">
    {t("common.step", { fallback: "Step" })}
    {wizard.currentStep}
    {t("common.of", { fallback: "of" })}
    {wizard.steps.length}
  </div>

  {#if wizard.currentStep < wizard.steps.length}
    <button
      class="btn btn-success"
      disabled={!wizard.nextEnabled || wizard.isCleaningUp || wizard.saving}
      onclick={wizard.nextStep}
    >
      {t("common.next", { fallback: "Next" })}
    </button>
  {/if}
  {#if wizard.currentStep === wizard.steps.length}
    <button class="btn btn-success" onclick={() => wizard.save()} disabled={wizard.isCleaningUp || wizard.saving}>
      {#if wizard.saving}
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        {t("import-assets.importing", { fallback: "Importing..." })}
      {:else}
        {t("import-assets.import-assets-btn", { fallback: "Import assets", count: assetCount })}
      {/if}
    </button>
  {/if}
</div>
