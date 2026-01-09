<script>
  import StatusBadgeDropdown from "$lib/components/common/StatusBadgeDropdown.svelte";

  let {
    institutionName = "",
    title = "",
    status = "",
    statusDisabled = false,
    onBack = undefined,
    onStatusChange = undefined,
  } = $props();

  const handleStatusChange = (e) => {
    onStatusChange?.(e.detail);
  };
</script>

<div class="container-fluid pb-4 bg-light">
  <div class="row mb-2">
    <div class="col-12">
      <div class="d-flex align-items-center gap-1 mt-3">
        <div>
          <button
            class="btn ps-0"
            aria-label="back"
            onclick={onBack}
          >
            <i class="bi bi-arrow-left"></i>
             {#if institutionName}
            <span>
                {institutionName}
            </span>
            {/if}
          </button>
        </div>
        

        <div class="ms-auto">
          <StatusBadgeDropdown
            status={status}
            disabled={statusDisabled}
            on:change={handleStatusChange}
          />
        </div>
      </div>

      <h1 class="mt-2">
        {title}
      </h1>
    </div>
  </div>
</div>
