<script>
  const { offcanvasBody, show = false } = $props();
</script>

{#if show}
  <div
    class="offcanvas offcanvas-end show"
    tabindex="-1"
    id="offcanvasExample"
    aria-labelledby="offcanvasExampleLabel"
  >
    <div class="offcanvas-header">
      <h5 class="offcanvas-title" id="offcanvasExampleLabel">title</h5>
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        onclick={() => history.back()}
      ></button>
    </div>
    <div class="offcanvas-body">
      {@render offcanvasBody?.()}
    </div>
  </div>
  <div class="offcanvas-backdrop fade show" style="pointer-events: auto;"></div>
{/if}
