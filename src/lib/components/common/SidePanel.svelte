<script>
  import { createEventDispatcher } from "svelte";
  import { fade } from "svelte/transition";

  let {
    isOpen = $bindable(),
    position = "right",
    closeOnBackdropClick = true,
    closeOnEscape = true,
    width = null, // New prop for custom width
  } = $props();

  const dispatch = createEventDispatcher();

  // currentWidth is now derived from the width prop or uses a default
  let currentWidth = $derived(width ? width : "650px");

  function close() {
    dispatch("close");
  }

  function handleKeydown(event) {
    // Only trigger close if the panel is open
    if (isOpen && closeOnEscape && event.key === "Escape") {
      close();
    }
  }

  // Add/remove Escape key listener globally using svelte:window
  // No need for manual tracking with $: block or onDestroy
</script>

<!-- Backdrop: Still conditionally rendered and faded -->
{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    class="backdrop"
    transition:fade={{ duration: 200 }}
    role="button"
    tabindex="0"
    onclick={() => {
      if (closeOnBackdropClick) close();
    }}
    onkeydown={(event) => {
      if (
        closeOnBackdropClick &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault(); // Prevent spacebar scrolling
        close();
      }
    }}
  ></div>
{/if}

<!-- Panel: Always rendered, visibility and transform controlled by CSS -->
<div
  class="side-panel {position}"
  class:panel-open={isOpen}
  style="width: {currentWidth};"
  role="dialog"
  aria-modal={isOpen ? "true" : "false"}
  aria-hidden={!isOpen}
  aria-labelledby="side-panel-title"
>
  <div class="panel-header">
    <slot name="header"></slot>
  </div>
  <div class="panel-content px-3">
    <slot></slot>
  </div>
  <!-- <div class="panel-footer">
        <slot name="footer"></slot>
    </div> -->
</div>

<!-- Global key listener attached only once -->
<svelte:window on:keydown={handleKeydown} />

<style>
  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }

  .side-panel {
    position: fixed;
    top: 0;
    height: 100%;
    background-color: var(--bs-body-bg, white);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition:
      transform 300ms ease-in-out,
      visibility 0s linear 300ms; /* Delay hiding visibility until transform is done */
    will-change: transform;
    visibility: hidden; /* Hidden by default */
    pointer-events: none; /* Non-interactive when hidden */
  }

  .side-panel.panel-open {
    visibility: visible; /* Visible when open */
    pointer-events: auto; /* Interactive when open */
    transition-delay: 0s; /* Apply visibility change immediately when opening */
  }

  .side-panel.right {
    right: 0;
    box-shadow: -2px 0 5px rgba(0, 0, 0, 0.2);
    transform: translateX(100%);
  }
  .side-panel.right.panel-open {
    transform: translateX(0);
  }

  .side-panel.left {
    left: 0;
    box-shadow: 2px 0 5px rgba(0, 0, 0, 0.2);
    transform: translateX(-100%);
  }
  .side-panel.left.panel-open {
    transform: translateX(0);
  }

  .panel-header {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bs-border-color, #dee2e6);
    flex-shrink: 0;
    position: relative;
    min-height: 50px;
  }

  .panel-content {
    flex-grow: 1;
    overflow-y: auto;
  }

  .panel-footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--bs-border-color, #dee2e6);
    flex-shrink: 0;
    background-color: var(--bs-tertiary-bg, #f8f9fa);
  }

  .close-button {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
    color: #6c757d;
    padding: 0.5rem;
  }
  .close-button:hover {
    color: #000;
  }

  :global(.side-panel [slot="header"]:not(:empty) ~ .close-button) {
    /* Potential rule if needed */
  }
</style>
