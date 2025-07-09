<script>
  import HeaderSwitch from "$lib/components/projects/HeaderSwitch.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();
</script>

<div
  class="header w-100 d-flex justify-content-between align-items-center py-2 text-bg-secondary border-bottom gap-2 px-1"
>
  <div class="col">
    <a class="btn btn-secondary btn-sm" href="/"
      ><i class="bi bi-chevron-left"></i>
      {t("header.all-projects", { fallback: "All projects" })}</a
    >
  </div>
  <div class="col d-flex justify-content-center">
    <HeaderSwitch />
  </div>

  <div class="col text-end">
    <div class="pe-3">Username</div>
  </div>
</div>
