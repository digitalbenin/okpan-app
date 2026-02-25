<script>
  import Cancel from "./Cancel.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();
</script>

<div
  class="w-100 bg-light p-3 d-flex justify-content-between align-items-center"
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
      disabled={!wizard.nextEnabled || wizard.isCleaningUp}
      onclick={wizard.nextStep}
    >
      {t("common.next", { fallback: "Next" })}
    </button>
  {/if}
  {#if wizard.currentStep === wizard.steps.length}
    <button class="btn btn-success" onclick={() => wizard.save()} disabled={wizard.isCleaningUp}>
      {t("common.save", { fallback: "Save" })}
    </button>
  {/if}
</div>
