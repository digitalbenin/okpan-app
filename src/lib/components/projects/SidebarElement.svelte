<script>
  import SidebarMenu from "$lib/components/projects/SidebarMenu.svelte";
  const { pathname, element, disabled = false } = $props();
  let isCollapsed = $state(true);

  $inspect(element.url, pathname)

  const hasChildren = $derived(element.children && element.children.length > 0);

  const isActive = $derived(
    hasChildren
      ? element.children.some((child) => pathname.startsWith(child.url))
      : element.exact
        ? pathname === element.url
        : pathname.startsWith(element.url) && !pathname.endsWith("add"),
  );

  function toggleCollapse() {
    if (hasChildren) {
      isCollapsed = !isCollapsed;
    }
  }
</script>

<div
  class="px-1 py-2 border-dark"
  class:border-bottom={isActive && !hasChildren}
>
  {#if hasChildren}
    <div
      role="button"
      tabindex="0"
      class="d-flex align-items-center justify-content-between"
      class:link-secondary={!isActive}
      class:link-dark={isActive}
      onclick={toggleCollapse}
      onkeydown={toggleCollapse}
      style="cursor: pointer;"
    >
      <div>
        {#if element.icon}
          <i class="bi bi-{element.icon} me-1"></i>
        {/if}
        {element.label}
      </div>
      <i class="bi bi-chevron-{isCollapsed ? 'right' : 'down'}"></i>
    </div>
    {#if !isCollapsed}
      <div class="ps-3">
        <SidebarMenu items={element.children} {pathname} />
      </div>
    {/if}
  {:else}
    <a
      href={element.url}
      class="d-flex align-items-center justify-content-between link-underline link-underline-opacity-0"
      class:link-secondary={!isActive}
      class:link-dark={isActive}
      style={disabled ? "opacity: 0.5;" : ""}
    >
      <div>
        {#if element.icon}
          <i class="bi bi-{element.icon} me-1"></i>
        {/if}
        {element.label}
      </div>
      <i class="bi bi-chevron-right"></i>
    </a>
  {/if}
</div>
