<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconBuildingBank } from "@tabler/icons-svelte";

  let {
    projectId = "",
    institutionId = "",
    institutionName = "",
    title = "",
    status = "",
    statusDisabled = false,
    showStatus = true,
    onStatusChange = undefined,
  } = $props();

  const { t } = getTranslationStore();

  const breadcrumbItems = $derived([
    { label: t("common.institutions"), href: `/projects/${projectId}/institutions` },
    { label: institutionName, href: `/projects/${projectId}/institutions/${institutionId}` },
    { label: title },
  ]);

  function handleStatusClick() {
    if (statusDisabled) return;
    const next = status === "completed" ? "in progress" : "completed";
    onStatusChange?.(next);
  }
</script>

<div class="border-bottom  py-3 w-100">
  <div class="d-flex justify-content-between align-items-start gap-2">
    <div class="flex-grow-1" style="min-width: 0;">
      <BaseBreadcrumb icon={IconBuildingBank} items={breadcrumbItems} />
    </div>


  </div>

  <div class="d-flex align-items-center gap-2 mt-1">
    <h2 class="mb-0" style="font-family: var(--bs-heading-font-family, 'Crimson Pro', serif); font-size: 32px; letter-spacing: -0.64px; color: var(--bs-body-color);">{title}</h2>
    {#if showStatus}
      <div class="flex-shrink-0">
        {#if onStatusChange}
          <button
            type="button"
            class="btn btn-link p-0 border-0 text-decoration-none"
            disabled={statusDisabled}
            onclick={handleStatusClick}
          >
            <BaseBadgeStatus status={status} showChevron={true} className="px-2 py-1 rounded-3" />
          </button>
        {:else}
          <BaseBadgeStatus status={status} showChevron={false} className="px-2 py-1 rounded-3" />
        {/if}
      </div>
    {/if}
  </div>
</div>

