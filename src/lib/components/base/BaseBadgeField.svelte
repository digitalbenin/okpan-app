<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { label } = $props();
  const { t } = getTranslationStore();
</script>

<span>
  <span class="text-muted fs-7">
    {t("import.matched-to", { fallback: "Matched to" })}
    <i class="bi bi-arrow-right"></i>
  </span>

  <span class="px-2 py-1 text-bg-light rounded text-capitalize">
    {label}
  </span>
</span>
