<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { assetsImported = 0, assetsLinked = 0 } = $props();
  const { t } = getTranslationStore();
</script>

<div class="d-flex gap-3 w-100">
  <div class="flex-fill border rounded-3 p-3 d-flex flex-column justify-content-between" style="background: #cce6df; border-color: #66b3a0 !important; min-height: 103px;">
    <span class="fw-normal" style="font-size: 40px; line-height: 1.2;">{assetsImported}</span>
    <span class="text-body">{t("import-assets.assets-will-be-imported-stat", { fallback: "Assets will be imported" })}</span>
  </div>
  <div class="flex-fill border rounded-3 p-3 d-flex flex-column justify-content-between" style="background: #cce6df; border-color: #66b3a0 !important; min-height: 103px;">
    <span class="fw-normal" style="font-size: 40px; line-height: 1.2;">{assetsLinked}</span>
    <span class="text-body">{t("import-assets.assets-will-be-linked-stat", { fallback: "Assets will be linked to objects" })}</span>
  </div>
</div>
