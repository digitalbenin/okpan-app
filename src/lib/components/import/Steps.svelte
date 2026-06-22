<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div class="w-100">
  <div class="rounded d-flex bg-white justify-content-between py-3 gap-2 px-4 border-bottom">
    {#each wizard.steps as step, i (step.id)}
      <div
        class="d-flex align-items-center gap-1 overflow-hidden"
      >
        <div
          class="step text-bg-primary fs-7 rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
          class:bg-gray-300={wizard.currentStep !== i + 1}
          class:border={wizard.currentStep !== i + 1}
          class:border-gray-800={wizard.currentStep !== i + 1}
          class:text-dark={wizard.currentStep !== i + 1}
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

  }
</style>
