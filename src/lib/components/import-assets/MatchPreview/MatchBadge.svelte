<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { id = $bindable(), primaryId } = $props();
  const { t } = getTranslationStore();

  function resetFieldMatched() {
    id = null;
  }
  $inspect(id);
</script>

{#if id}
  <div
    class="d-flex align-items-center bg-white rounded overflow-hidden text-capitalize position-relative"
  >
    {#if true}
      <div class="px-2 p-1 text-bg-primary">
        <i class="bi bi-stars"></i>
      </div>
    {/if}
    <div class="ps-2">{id}</div>

    <button
      class="btn btn-sm"
      onclick={resetFieldMatched}
      aria-label={t("import.reset-match", {
        fallback: "Reset match",
      })}
    >
      <i class="bi bi-x-lg"></i>
    </button>
  </div>
{:else}
  <span
    class="d-inline-block bg-white px-2 py-1 rounded text-capitalize fst-italic text-muted"
  >
    {t("import.not-set", { fallback: "Not set" })}
  </span>
{/if}
