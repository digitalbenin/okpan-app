<script>
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
        class="d-flex align-items-center bg-white px-2 py-1 rounded text-capitalize position-relative"
        {...(({ type, ...rest }) => rest)(props)}
      >
        {#if field.suggestion}
          <span class="p-1 bg-primary border border-light rounded-circle me-1">
            <span class="visually-hidden">Suggested field</span>
          </span>
        {/if}
        {field.name}
        {#if !disabled}
          <button
            class="btn btn-sm p-0 ms-1"
            onclick={resetFieldMatched}
            aria-label={t("import.reset-match", {
              fallback: "Reset match",
            })}
          >
            <i class="bi bi-x-lg"></i>
          </button>
        {/if}
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
