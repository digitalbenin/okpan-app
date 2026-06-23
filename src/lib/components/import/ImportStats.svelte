<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { objectsCount = 0, fieldsCount = 0, mappedCount = 0, identifierField = "" } = $props();
  const { t } = getTranslationStore();
</script>

<div class="d-flex gap-3 w-100">
  <div class="flex-fill border rounded-3 p-3 d-flex flex-column justify-content-between" style="background: #cce6df; border-color: #66b3a0 !important; min-height: 103px;">
    <span class="fw-normal" style="font-size: 40px; line-height: 1.2;">{objectsCount}</span>
    <span class="text-body">{t("import.objects-to-import", { fallback: "Objects to import" })}</span>
  </div>
  <div class="flex-fill border rounded-3 p-3 d-flex flex-column justify-content-between" style="background: #cce6df; border-color: #66b3a0 !important; min-height: 103px;">
    <span class="fw-normal" style="font-size: 40px; line-height: 1.2;">{fieldsCount}</span>
    <span class="text-body">{t("import.fields-imported", { fallback: "Fields imported" })}</span>
  </div>
  <div class="flex-fill border rounded-3 p-3 d-flex flex-column justify-content-between" style="background: #cce6df; border-color: #66b3a0 !important; min-height: 103px;">
    <span class="fw-normal" style="font-size: 40px; line-height: 1.2;">{mappedCount}</span>
    <span class="text-body">{t("import.mapped-fields", { fallback: "Mapped fields" })}</span>
  </div>
  <div class="flex-fill border rounded-3 p-3 d-flex flex-column justify-content-between" style="background: #cce6df; border-color: #66b3a0 !important; min-height: 103px;">
    <span class="fw-semibold" style="font-size: 16px; line-height: 1.5;">{identifierField}</span>
    <span class="text-body">{t("import.object-identifier-label", { fallback: "Object identifier" })}</span>
  </div>
</div>
