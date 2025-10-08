<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { createEventDispatcher } from "svelte";

  export let status = "";
  export let availableStatuses = ["in progress", "completed"]; // default options; override for institutions
  export let disabled = false;
  export let menuMinWidth = "220px";
  export let menuClass = ""; // extra classes for menu wrapper if needed
  export let itemClass = ""; // extra classes for items if needed

  const dispatch = createEventDispatcher();
  let showMenu = false;

  const normalized = (s) => (s || "").toLowerCase();
  $: options = (availableStatuses || []).map((s) => ({
    value: s,
    label: `mark as ${s}`,
  }));

  function toggleMenu() {
    if (!disabled) showMenu = !showMenu;
  }

  function selectStatus(next) {
    if (disabled) return;
    dispatch("change", next);
    showMenu = false;
  }
</script>

<span class="badgeWrapper fs-6 position-relative d-inline-block" tabindex="0">
  <button
    type="button"
    class="btn btn-link p-0 m-0 border-0 text-decoration-none"
    aria-haspopup="true"
    aria-expanded={showMenu}
    on:click={toggleMenu}
  >
    <BaseBadgeStatus status={status} showChevron={true} />
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
            on:click={() => selectStatus(opt.value)}
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