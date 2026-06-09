<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconLink, IconUnlink } from "@tabler/icons-svelte";

  const { t } = getTranslationStore();
  const { linked } = $props();
</script>

<div class="d-flex align-items-center gap-1 fs-6">
  <div
    class="dot rounded-circle"
    class:bg-success={linked}
    class:bg-warning={!linked}
  ></div>
  <div class="d-flex align-items-start  gap-1">
    
    {#if linked}
      <IconLink size={20} class="text-success" />
      <p>{t("common.linked", { fallback: "linked" })}</p>
    {:else}
      <IconUnlink size={20} class="text-warning" />
      <p>{t("common.not-linked", { fallback: "not linked" })}</p>
    {/if}
  </div>
</div>

