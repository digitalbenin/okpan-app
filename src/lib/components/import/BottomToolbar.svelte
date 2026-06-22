<script>
  import Cancel from "./Cancel.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div
  class="w-100 bg-white p-3 d-flex justify-content-between align-items-center my-n4 border-top"
>
  <div class="d-flex gap-2">
    <Cancel />
    {#if wizard.currentStep > 1}
      <button class="btn btn-outline-secondary" onclick={wizard.prevStep}>
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
      disabled={!wizard.nextEnabled || wizard.saving}
      onclick={async () => {
        if (wizard.submitStep) {
          await wizard.submitStep();
        } else {
          wizard.nextStep();
        }
      }}
    >
      {#if wizard.saving}
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        {t("common.saving", { fallback: "Saving..." })}
      {:else}
        {t("common.next", { fallback: "Next" })}
      {/if}
    </button>
  {/if}
  {#if wizard.currentStep === wizard.steps.length}
    <button class="btn btn-success" onclick={() => wizard.save()} disabled={wizard.saving}>
      {#if wizard.saving}
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        {t("common.saving", { fallback: "Saving..." })}
      {:else}
        {t("common.save", { fallback: "Save" })}
      {/if}
    </button>
  {/if}
</div>
