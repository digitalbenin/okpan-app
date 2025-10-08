<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";

  let { mappedObject = $bindable(null) } = $props();
  const { t } = getTranslationStore();

  function resetFieldMatched() {
    mappedObject = null;
  }

  let primaryId = $derived.by(() => {
    if (!mappedObject) return null;
    return getObjectIdentifier(mappedObject);
  });
</script>

{#if mappedObject}
  <div
    class="d-flex align-items-center bg-white rounded overflow-hidden text-capitalize position-relative"
  >
    {#if true}
      <div class="px-2 p-1 text-bg-primary">
        <i class="bi bi-stars"></i>
      </div>
    {/if}
    <div class="ps-2">{primaryId}</div>

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
