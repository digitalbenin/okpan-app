<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div class="px-2 mt-2 w-100">
  <div class="bg-light rounded d-flex justify-content-between p-2 gap-2">
    {#each wizard.steps as step, i (step.id)}
      <div
        class="d-flex align-items-center gap-1 overflow-hidden"
        class:disabled={wizard.currentStep !== i + 1}
      >
        <div
          class="step text-bg-primary rounded d-flex align-items-center justify-content-center flex-shrink-0"
        >
          <div>{i + 1}</div>
        </div>
        <div class="text-truncate">
          {t(step.t, { fallback: step.fallback })}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .step {
    width: 2rem;
    height: 2rem;
  }

  .disabled {
    pointer-events: none;
    opacity: 0.65;
  }
</style>
