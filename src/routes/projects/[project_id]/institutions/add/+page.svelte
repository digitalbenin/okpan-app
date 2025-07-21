<script>
  import { browser } from "$app/environment";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();

  function cancel() {
    if (browser) window.history.back();
  }
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col-6">
      <h2 class="mt-3">
        {t("common.add-new-institution", { fallback: "Add New Institution" })}
      </h2>
      <p>
        {t("common.add-new-institution-desc", {
          fallback:
            "Please fill out the details below to add a new institution to your project.",
        })}
      </p>
      <BaseInput
        placeholder={t("common.institution-name", {
          fallback: "Institution Name",
        })}
        class="mb-3"
      ></BaseInput>
    </div>
  </div>
</div>
<div
  class="position-absolute bottom-0 start-0 w-100 bg-light z-1 p-3 d-flex justify-content-between"
>
  <button class="btn btn-outline-secondary" onclick={cancel}>
    <i class="bi bi-chevron-left"></i>
    {t("common.cancel", { fallback: "Cancel" })}</button
  >
  <button class="btn btn-success">
    {t("common.confirm", { fallback: "Confirm" })}</button
  >
</div>
