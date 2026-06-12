<script>
  import { IconChevronRight } from "@tabler/icons-svelte";

  let { items = [], icon } = $props();
</script>

<div class="d-flex align-items-center">
  {#if icon}
    <span class="d-flex align-items-center justify-content-start rounded-3 flex-shrink-0 me-n2" style="width: 40px; height: 40px;">
      <svelte:component this={icon} size={20} class="text-body-secondary" />
    </span>
  {/if}

  {#each items as item, i}
    {#if i > 0}
      <IconChevronRight size={14} class="text-body-secondary mx-1 flex-shrink-0" />
    {/if}
    {#if item.href && i < items.length - 1}
      <a href={item.href} class="fs-7 text-body-secondary text-decoration-none text-truncate" style="max-width: 200px;">{item.label}</a>
    {:else if i === items.length - 1}
      <span class="fs-7 text-truncate" style="max-width: 300px; color: var(--bs-body-color);">{item.label}</span>
    {:else}
      <span class="fs-7 text-body-secondary text-truncate" style="max-width: 200px;">{item.label}</span>
    {/if}
  {/each}
</div>


