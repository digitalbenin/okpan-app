<script>
  import StatusBadgeDropdown from "$lib/components/common/StatusBadgeDropdown.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    institutionName = "",
    title = "",
    status = "",
    statusDisabled = false,
    showStatus = true,
    onBack = undefined,
    onStatusChange = undefined,
  } = $props();

  const { t } = getTranslationStore();
</script>

<div class="container-fluid py-4 ">
  {#if onBack || (institutionName && showStatus) || showStatus}
    <div class="row mb-3">
      <div class="col-12">
        <div class="d-flex align-items-center gap-2">
          {#if onBack}
            <button
              class="btn ps-0"
              aria-label={t("nav.back", { fallback: "Back" })}
              onclick={onBack}
            >
              <i class="bi bi-arrow-left"></i>
              {#if institutionName}
                <span>{institutionName}</span>
              {/if}
            </button>
          {:else if institutionName && showStatus}
            <div class="text-muted small">{institutionName}</div>
          {/if}

          {#if showStatus}
            <div class="ms-auto">
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

  <div class="row">
    <div class="col-12">
      <h1 class="h3 mb-0">{title}</h1>
    </div>
  </div>
</div>
