<script>
  import SidebarMenu from "$lib/components/projects/SidebarMenu.svelte";
  const { pathname, element, disabled = false } = $props();
  let isCollapsed = $state(true);

  const hasChildren = $derived(element.children && element.children.length > 0);

  const isActive = $derived(
    hasChildren
      ? element.children.some((child) => pathname === child.url || pathname.startsWith(child.url + "/"))
      : element.exact
        ? pathname === element.url
        : pathname === element.url || pathname.startsWith(element.url + "/"),
  );

  function toggleCollapse() {
    if (disabled) {
      return;
    }

    if (hasChildren) {
      isCollapsed = !isCollapsed;
    }
  }

  function blockWhenDisabled(event) {
    if (!disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }
</script>

<div
  class="px-1 py-2 border-dark"
  class:bg-primary={isActive && !hasChildren}
  class:bg-opacity-10={isActive && !hasChildren}
  class:rounded-2={isActive && !hasChildren}
>
  {#if hasChildren}
    <div
      role="button"
      tabindex={disabled ? -1 : 0}
      aria-disabled={disabled}
      class="d-flex align-items-center justify-content-between text-decoration-none"
      class:link-secondary={!isActive}
      class:link-primary={isActive}
      onclick={toggleCollapse}
      onkeydown={toggleCollapse}
      style={disabled ? "opacity: 0.5; cursor: not-allowed;" : "cursor: pointer;"}
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
      <div class="ps-3 pt-2">
        <SidebarMenu items={element.children} {pathname} />
      </div>
    {/if}
  {:else}
    <a
      href={disabled ? undefined : element.url}
      aria-disabled={disabled}
      tabindex={disabled ? -1 : undefined}
      class="d-flex align-items-center justify-content-between text-decoration-none"
      class:link-secondary={!isActive}
      class:link-primary={isActive}
      onclick={blockWhenDisabled}
      style={disabled ? "opacity: 0.5; cursor: not-allowed; pointer-events: none;" : ""}
    >
      <div>
        {#if element.icon}
          <i class="bi bi-{element.icon} me-1"></i>
        {/if}
        {element.label}
      </div>
    </a>
  {/if}
</div>
