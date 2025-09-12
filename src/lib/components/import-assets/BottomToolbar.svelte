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
  <Cancel></Cancel>
  <div class="text-primary fw-bold">
    {t("common.step", { fallback: "Step" })}
    {wizard.currentStep}
    {t("common.of", { fallback: "of" })}
    {wizard.steps.length}
  </div>

  <button
    class="btn btn-success"
    class:invisible={wizard.currentStep === wizard.steps.length}
    disabled={!wizard.nextEnabled}
    onclick={wizard.nextStep}
  >
    {t("common.next", { fallback: "Next" })}
  </button>
</div>
