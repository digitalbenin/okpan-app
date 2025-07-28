<script>
  const { pathname, element } = $props();
  const isActive = $derived.by(() => {
    if (element.exact) {
      return pathname === element.url;
    }
    return pathname.startsWith(element.url) && !pathname.endsWith("add");
  });
</script>

<div class="px-1 py-2 border-dark" class:border-bottom={isActive}>
  <a
    href={element.url}
    class="d-flex align-items-center justify-content-between link-underline link-underline-opacity-0"
    class:link-secondary={!isActive}
    class:link-dark={isActive}
  >
    <div>
      {#if element.icon}
        <i class="bi bi-{element.icon} me-1"></i>
      {/if}
      {element.label}
    </div>
    <i class="bi bi-chevron-right"></i>
  </a>
</div>
