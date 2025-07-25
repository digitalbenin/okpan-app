<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ActionTimeAgo from "./ActionTimeAgo.svelte";
  const { t } = getTranslationStore();
  const { actions } = $props();
</script>

<div class="bg-white rounded border d-flex flex-column p-4">
  <h3 class="mb-3">
    {t("common.last-actions", { fallback: "Last actions" })}
  </h3>
  <div>
    {#each actions as action}
      <div
        class="border-bottom mb-3 d-flex justify-content-between align-items-baseline"
      >
        <div>
          <span class="fst-italic">{action.user_id || "A user"}</span>
          {action.action_type}
          {action.entity_type}
        </div>
        <div>
          {#if action.changes && action.changes.timestamp}
            <ActionTimeAgo timestamp={action.changes.timestamp}></ActionTimeAgo>
          {:else}
            <span class="text-black-50">-</span>
          {/if}
        </div>
      </div>
    {/each}
    {#if actions.length === 0}
      <div class="fst-italic">
        {t("common.no-actions", { fallback: "No actions yet!" })}
      </div>
    {/if}
  </div>
</div>
