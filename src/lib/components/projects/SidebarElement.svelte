<script>
  import SidebarMenu from "$lib/components/projects/SidebarMenu.svelte";
  import {
    IconLayoutDashboard,
    IconBuildingBank,
    IconBox,
    IconChartCircles,
    IconCirclePlus,
    IconTableImport,
    IconPhotoUp,
    IconWorldCog,
    IconWorldUpload,
    IconTableExport,
    IconTableOptions,
    IconSettings,
    IconChevronRight,
    IconChevronDown,
  } from "@tabler/icons-svelte";

  const { pathname, element, disabled = false } = $props();
  let isCollapsed = $state(true);

  const hasChildren = $derived(element.children && element.children.length > 0);

  const isActive = $derived(hasChildren
    ? element.children.some(child => pathname === child.url || pathname.startsWith(child.url + '/'))
    : element.exact
      ? pathname === element.url
      : (pathname === element.url || pathname.startsWith(element.url + '/'))
        && !(element.excludePaths || []).some(suffix => pathname === element.url + suffix));

  const iconMap = {
    "layout-dashboard": IconLayoutDashboard,
    "building-bank": IconBuildingBank,
    "box": IconBox,
    "chart-circles": IconChartCircles,
    "circle-plus": IconCirclePlus,
    "table-import": IconTableImport,
    "photo-up": IconPhotoUp,
    "world-cog": IconWorldCog,
    "world-up": IconWorldUpload,
    "table-export": IconTableExport,
    "table-options": IconTableOptions,
    "settings": IconSettings,
  };

  function toggleCollapse() {
    if (disabled) return;
    if (hasChildren) {
      isCollapsed = !isCollapsed;
    }
  }

  function blockWhenDisabled(event) {
    if (disabled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }
</script>

<div
  class="ps-2 pe-1 py-1 m-1" 
  class:bg-green-100={isActive && !hasChildren}
  class:border={isActive && !hasChildren}
  class:border-green-200={isActive && !hasChildren}
  class:rounded-3={isActive && !hasChildren}
>
  {#if hasChildren}
    <div
      role="button"
      tabindex={disabled ? -1 : 0}
      aria-disabled={disabled}
      class="d-flex align-items-center justify-content-between text-decoration-none fs-7"
      class:nav-link-active={isActive}
      class:nav-link={!isActive}
      onclick={toggleCollapse}
      onkeydown={toggleCollapse}
      style={disabled ? "opacity: 0.5; cursor: not-allowed;" : "cursor: pointer;"}
    >
      <div class="d-flex align-items-center gap-2">
        {#if element.icon}
          {@const Icon = iconMap[element.icon]}
          {#if Icon}
            <Icon size={20} stroke={2} />
          {/if}
        {/if}
        {element.label}
      </div>
      {#if isCollapsed}
        <IconChevronRight size={12} stroke={2} />
      {:else}
        <IconChevronDown size={12} stroke={2} />
      {/if}
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
      class="d-flex align-items-center justify-content-between text-decoration-none fs-7"
      class:nav-link-active={isActive}
      class:nav-link={!isActive}
      onclick={blockWhenDisabled}
      style={disabled ? "opacity: 0.5; cursor: not-allowed; pointer-events: none;" : ""}
    >
      <div class="d-flex align-items-center gap-2">
        {#if element.icon}
          {@const Icon = iconMap[element.icon]}
          {#if Icon}
            <Icon size={20} stroke={2} />
          {/if}
        {/if}
        {element.label}
      </div>
    </a>
  {/if}
</div>

<style>
  .nav-link {
    color: rgba(0, 0, 0, 0.65);
  }
  .nav-link-active {
    color: rgba(0, 0, 0, 0.8);
  }
</style>
