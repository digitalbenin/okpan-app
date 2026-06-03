<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";

  let {
    status = "",
    availableStatuses = ["in progress", "completed"],
    disabled = false,
    menuMinWidth = "220px",
    menuClass = "",
    itemClass = "",
    onchange = undefined,
  } = $props();

  let showMenu = $state(false);

  const normalized = (s) => (s || "").toLowerCase();

  const options = $derived(
    (availableStatuses || []).map((s) => ({
      value: s,
      label: `mark as ${s}`,
    }))
  );

  function toggleMenu() {
    if (!disabled) showMenu = !showMenu;
  }

  function selectStatus(next) {
    if (disabled) return;
    onchange?.(next);
    showMenu = false;
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<span class="badgeWrapper fs-6 position-relative d-inline-block" tabindex="0">
  <button
    type="button"
    class="btn btn-link p-0 m-0 border-0 text-decoration-none"
    aria-haspopup="true"
    aria-expanded={showMenu}
    onclick={toggleMenu}
  >
    <BaseBadgeStatus status={status} showChevron={true} className="p-2" />
  </button>

  {#if showMenu}
    <div
      class={`position-absolute mt-1 bg-white border rounded shadow-sm p-1 ${menuClass}`}
      style={`min-width: ${menuMinWidth}; z-index: 1000;`}
    >
      {#each options as opt (opt.value)}
        {#if normalized(opt.value) !== normalized(status)}
          <button
            class={`dropdown-item py-1 px-2 ${itemClass}`}
            disabled={disabled}
            onclick={() => selectStatus(opt.value)}
          >
            {opt.label}
          </button>
        {/if}
      {/each}
    </div>
  {/if}
</span>

<style>
  .badgeWrapper {
    font-family: var(--bs-body-font-family) !important;
    vertical-align: text-top;
  }
</style>
