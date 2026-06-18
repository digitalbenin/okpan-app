<script>
  import { IconSearch } from "@tabler/icons-svelte";

  let { search = $bindable(""), placeholder = "Search", oninput, border = "border-white", width, children, toolbar } = $props();
</script>

<div class="d-flex justify-content-between align-items-center pb-3 mt-4 w-100">
  <div class="input-group" style="width: {width ?? '300px'};">
    <input
      type="text"
      class="form-control border-end-0 {border}"
      {placeholder}
      bind:value={search}
      {oninput}
    />
    <span class="input-group-text bg-white relative  {border}" style="left: -1px; border-left: none;">
      <IconSearch size={18} class="text-body-secondary" />
    </span>
  </div>
  <div class="d-flex gap-2">
    {#if children}
      {@render children()}
    {/if}
  </div>
</div>

{#if toolbar}
  <div class="position-relative d-flex justify-content-between align-items-center pb-3">
    {@render toolbar()}
  </div>
{/if}
