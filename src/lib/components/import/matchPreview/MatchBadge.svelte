<script>
  import { IconSparkles, IconLink, IconX } from "@tabler/icons-svelte";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { field = $bindable(), disabled = false } = $props();
  const { t } = getTranslationStore();

  function resetFieldMatched() {
    field = null;
  }
</script>

{#if field}
  <BaseTooltip>
    {#snippet trigger(props)}
      <div
        class="d-flex align-items-center bg-white rounded-2 text-capitalize border-0"
        {...(({ type, ...rest }) => rest)(props)}
      >
        {#if field.suggestion}
          <div
            class="d-flex align-items-center justify-content-center border-0 rounded-start bg-primary px-1 me-2"
          >
            <IconSparkles size={16} class="text-white" />
          </div>
        {/if}

        <div class="px-2 py-1">
          <IconLink size={16} class="me-2" />
        {field.name}
        {#if !disabled}
          <button
            class="btn btn-sm p-0 ms-1"
            onclick={resetFieldMatched}
            aria-label={t("import.reset-match", {
              fallback: "Reset match",
            })}
          >
            <IconX size={16} />
          </button>
        {/if}
        </div>
      </div>
    {/snippet}
    {field.description}
  </BaseTooltip>
{:else}
  <span
    class="d-inline-block bg-white px-2 py-1 rounded text-capitalize fst-italic text-muted"
  >
    {t("import.not-set", { fallback: "Not set" })}
  </span>
{/if}
