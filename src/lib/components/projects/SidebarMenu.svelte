<script>
  const { items, pathname } = $props();
</script>

<div class="w-100 d-flex flex-column fs-7 mb-3">
  {#each items as item}
    <div
      class="px-1 py-2 border-dark"
      class:border-bottom={pathname.startsWith(item.url)}
    >
      <a
        href={item.url}
        class="d-flex align-items-center justify-content-between link-underline link-underline-opacity-0"
        class:link-secondary={!pathname.startsWith(item.url)}
        class:link-dark={pathname.startsWith(item.url)}
      >
        <div>
          {#if item.icon}
            <i class="bi bi-{item.icon} me-1"></i>
          {/if}
          {item.label}
        </div>
        <i class="bi bi-chevron-right"></i>
      </a>
    </div>
  {/each}
</div>
