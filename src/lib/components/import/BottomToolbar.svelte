<script>
  import Cancel from "./Cancel.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div
  class="w-100 bg-light p-3 d-flex justify-content-between align-items-center"
>
  <Cancel></Cancel>
  <div class="text-primary fw-bold">
    {t("common.step", { fallback: "Step" })}
    {wizard.currentStep}
    {t("common.of", { fallback: "of" })}
    {wizard.steps.length}
  </div>

  {#if wizard.currentStep < wizard.steps.length}
    <button
      class="btn btn-success"
      disabled={!wizard.nextEnabled}
      onclick={wizard.nextStep}
    >
      {t("common.next", { fallback: "Next" })}
    </button>
  {/if}
  {#if wizard.currentStep === wizard.steps.length}
    <button class="btn btn-success" onclick={() => wizard.save()}>
      {t("common.save", { fallback: "Save" })}
    </button>
  {/if}
</div>
