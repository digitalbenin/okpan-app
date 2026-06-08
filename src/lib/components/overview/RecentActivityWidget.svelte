<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ActivityTimeAgo from "./ActivityTimeAgo.svelte";
  import { formatActivityMessageFallback, resolveActivityMessageKey } from "$lib/constants/activityFeedDefinitions.js";
  import { IconRefresh, IconTrash, IconFileImport } from "@tabler/icons-svelte";

  const { t } = getTranslationStore();
  const { activities = [] } = $props();

  const ACTION_ICONS = {
    create: "plus-lg",
    delete: "trash",
    remove: "trash",
    update: "pencil",
    add: "pencil",
  };

  function getActivityIcon(activity) {
    return ACTION_ICONS[activity.action_type] ?? "pencil";
  }

  function getActivityMessage(activity) {
    const summaryParams = activity.summary_params || {};
    const rawInstitutionName = summaryParams.institutionName || activity.institution_name || null;
    const institutionName = rawInstitutionName || t("activity.unknown-institution", {
      fallback: "an institution"
    });
    const messageKey = resolveActivityMessageKey(activity.message_key, {
      omitInstitution: !rawInstitutionName
    });
    const params = {
      ...summaryParams,
      actor: activity.actor_username || t("common.user", { fallback: "A user" }),
      count: activity.item_count || 1,
      institutionName
    };

    return t(messageKey, {
      ...params,
      fallback: formatActivityMessageFallback(messageKey, params)
    });
  }
</script>

<div class="bg-white rounded-4 border d-flex flex-column p-4 gap-4">
  <div class="text-uppercase fw-normal small" style="letter-spacing: 0.04em;">
    {t("activity.title", { fallback: "Recent activity" })}
  </div>
  <div>
    {#each activities as activity}
      <div class="d-flex gap-2 align-items-start py-2 border-bottom">
        <div
          class="rounded-circle bg-secondary  border d-flex align-items-center justify-content-center flex-shrink-0"
          style="width: 30px; height: 30px;"
        >
          {#if getActivityIcon(activity) === "plus-lg"}
            <IconFileImport class="fs-4 text-white" style="width: 1rem; height: 1rem;" />
          {:else if getActivityIcon(activity) === "trash"}
            <IconTrash class="fs-4 text-white" style="width: 1rem; height: 1rem;" />
          {:else if getActivityIcon(activity) === "pencil"}
            <IconRefresh class="fs-4 text-white" style="width: 1rem; height: 1rem;" />
          {/if}
        </div>
        <div>
          <div class="lh-sm small">{getActivityMessage(activity)}</div>
          <div class="small text-secondary">
            <ActivityTimeAgo timestamp={activity.updated_at || activity.created_at} />
          </div>
        </div>
      </div>
    {/each}
    {#if activities.length === 0}
      <div class="fst-italic small">
        {t("activity.empty", { fallback: "No activity yet." })}
      </div>
    {/if}
  </div>
</div>
