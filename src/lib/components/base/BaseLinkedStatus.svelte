<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();
  const { linked } = $props();
</script>

<div class="d-flex align-items-center gap-1 fs-7 text-black-50">
  <div
    class="dot rounded-circle"
    class:bg-success={linked}
    class:bg-warning={!linked}
  ></div>
  <div>
    {#if linked}
      {t("common.linked", { fallback: "linked" })}
    {:else}
      {t("common.not-linked", { fallback: "not linked" })}
    {/if}
  </div>
</div>

<style>
  .dot {
    width: 16px;
    height: 16px;
  }
</style>
