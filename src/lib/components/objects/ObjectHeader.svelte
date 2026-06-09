<script>
  import StatusBadgeDropdown from "$lib/components/common/StatusBadgeDropdown.svelte";
  import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconBox } from "@tabler/icons-svelte";

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
</script>

<div class="container-fluid px-0 pt-0 py-4 ">
  {#if institutionName || showStatus}
    <div class="row">
      <div class="col-12">
        <div class="d-flex align-items-center gap-2">
          <BaseBreadcrumb icon={IconBox} items={breadcrumbItems} />

          {#if showStatus}
            <div class="ms-auto flex-shrink-0">
              <StatusBadgeDropdown
                status={status}
                disabled={statusDisabled}
                onchange={onStatusChange}
              />
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="row px-3">
    <div class="col-12">
      <h2 class="mb-0">{title}</h2>
    </div>
  </div>
</div>
