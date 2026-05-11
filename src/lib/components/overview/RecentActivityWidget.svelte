<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ActivityTimeAgo from "./ActivityTimeAgo.svelte";
  import { formatActivityMessageFallback } from "$lib/constants/activityFeedDefinitions.js";

  const { t } = getTranslationStore();
  const { activities = [] } = $props();

  function getActivityMessage(activity) {
    const summaryParams = activity.summary_params || {};
    const params = {
      actor: activity.actor_username || t("common.user", { fallback: "A user" }),
      count: activity.item_count || 1,
      institutionName: summaryParams.institutionName || activity.institution_name || t("activity.unknown-institution", {
        fallback: "an institution"
      }),
      ...summaryParams
    };

    return t(activity.message_key, {
      ...params,
      fallback: formatActivityMessageFallback(activity.message_key, params)
    });
  }
</script>

<div class="bg-white rounded border d-flex flex-column p-4">
  <h3 class="mb-3">
    {t("activity.title", { fallback: "Recent activity" })}
  </h3>
  <div>
    {#each activities as activity}
      <div
        class="border-bottom mb-3 pb-3 d-flex justify-content-between align-items-start gap-3"
      >
        <div class="lh-sm">
          {getActivityMessage(activity)}
        </div>
        <div class="flex-shrink-0">
          <ActivityTimeAgo timestamp={activity.updated_at || activity.created_at}></ActivityTimeAgo>
        </div>
      </div>
    {/each}
    {#if activities.length === 0}
      <div class="fst-italic">
        {t("activity.empty", { fallback: "No activity yet." })}
      </div>
    {/if}
  </div>
</div>
