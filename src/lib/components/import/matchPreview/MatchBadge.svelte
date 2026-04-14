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
        class="d-flex align-items-center bg-white rounded-2 text-capitalize border-0"
        {...(({ type, ...rest }) => rest)(props)}
      >
        {#if field.suggestion || field.source === "auto" || field.mappingSource === "auto"}
          <div
            class="d-flex align-items-center justify-content-center border-0 rounded-start bg-primary px-1 me-2"
          >
            <i class="bi bi-stars text-white" style="font-size: 1.2rem;"></i>
          </div>
        {/if}

        <div class="px-2 py-1">
          <i class="bi bi-link-45deg me-2"></i>
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
