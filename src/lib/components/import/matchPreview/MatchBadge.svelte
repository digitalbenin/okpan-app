<script>
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { field } = $props();
  const { t } = getTranslationStore();
</script>

{#if field.id}
  <BaseTooltip>
    {#snippet trigger(props)}
      <span class="btn btn-success text-capitalize" {...props}>
        {field.name || t("import.not-set", { fallback: "Not set" })}
      </span>
    {/snippet}
    {field.description}
  </BaseTooltip>
{:else}
  <span class="btn btn-warning text-capitalize fst-italic">
    {field.name || t("import.not-set", { fallback: "Not set" })}
  </span>
{/if}
