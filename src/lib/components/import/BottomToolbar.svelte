<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div
  class="position-absolute bottom-0 start-0 w-100 bg-light z-1 p-3 d-flex justify-content-between align-items-center"
>
  <button class="btn btn-outline-secondary">
    <i class="bi bi-chevron-left"></i>
    {t("common.cancel", { fallback: "Cancel" })}</button
  >
  <div class="text-primary fw-bold">
    {t("common.step", { fallback: "Step" })}
    {wizard.currentStep}
    {t("common.of", { fallback: "of" })}
    {wizard.steps.length}
  </div>
  <button class="btn btn-success">
    {t("common.confirm", { fallback: "Confirm" })}</button
  >
</div>
