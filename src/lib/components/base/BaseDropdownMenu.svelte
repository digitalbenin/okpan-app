<script>
  import { DropdownMenu } from "bits-ui";
  import { onDestroy } from "svelte";

  let {
    open = $bindable(false),
    items = [],
    trigger,
    children,
    contentProps = {},
    portalProps,
    triggerClass = "",
    triggerStyle = "",
    side = "bottom",
    align = "start",
    sideOffset = 4,
    alignOffset = 0,
    onItemClick = null,
    ...restProps
  } = $props();

  // Workaround for bits-ui pointer-events bug
  $effect(() => {
    if (!open) {
      // When dropdown closes, remove pointer-events: none from body
      setTimeout(() => {
        document.body.style.pointerEvents = '';
      }, 100);
    }
  });

  // Also clean up on component destroy
  onDestroy(() => {
    setTimeout(() => {
      document.body.style.pointerEvents = '';
    }, 100);
  });

  function handleItemClick(item) {
    if (onItemClick) {
      onItemClick(item);
    }
    if (item.onClick) {
      item.onClick();
    }
    // Close menu after item click unless specified otherwise
    if (item.keepOpen !== true) {
      open = false;
    }
  }
</script>

<DropdownMenu.Root bind:open {...restProps}>
  <DropdownMenu.Trigger class={triggerClass} style={triggerStyle}>
    {@render trigger()}
  </DropdownMenu.Trigger>
  
  <DropdownMenu.Portal {...portalProps}>
    <DropdownMenu.Content 
      {side} 
      {align} 
      {sideOffset} 
      {alignOffset}
      {...contentProps}
      style="z-index: 9999; position: fixed; {contentProps.style || ''}"
    >
      {#snippet child({ wrapperProps, props, open: isOpen })}
        {#if isOpen}
          <div {...wrapperProps} style="{wrapperProps.style}; z-index: 100000;">
            <div 
              {...props} 
              class="dropdown-menu show shadow-sm border-0 rounded-2 px-1 py-2 {contentProps.class || ''}"
              style={contentProps.style || ''}
            >
              {#if children}
                {@render children({ close: () => open = false })}
              {:else}
                {#each items as item}
                  {#if item.type === 'separator'}
                    <DropdownMenu.Separator class="dropdown-divider my-1" />
                  {:else if item.type === 'group'}
                    <DropdownMenu.Group>
                      {#if item.label}
                        <DropdownMenu.GroupHeading class="dropdown-header px-2 py-1 text-muted fs-7 text-uppercase">
                          {item.label}
                        </DropdownMenu.GroupHeading>
                      {/if}
                      {#each item.items as groupItem}
                        <DropdownMenu.Item 
                          class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2 {groupItem.disabled ? 'disabled' : ''}"
                          disabled={groupItem.disabled}
                          onclick={() => handleItemClick(groupItem)}
                        >
                          {#if groupItem.icon}
                            <i class="bi bi-{groupItem.icon}"></i>
                          {/if}
                          <span class="flex-grow-1">{groupItem.label}</span>
                          {#if groupItem.shortcut}
                            <small class="text-muted">{groupItem.shortcut}</small>
                          {/if}
                        </DropdownMenu.Item>
                      {/each}
                    </DropdownMenu.Group>
                  {:else}
                    <DropdownMenu.Item 
                      class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2 {item.disabled ? 'disabled' : ''}"
                      disabled={item.disabled}
                      onclick={() => handleItemClick(item)}
                    >
                      {#if item.icon}
                        <i class="bi bi-{item.icon}"></i>
                      {/if}
                      <span class="flex-grow-1">{item.label}</span>
                      {#if item.shortcut}
                        <small class="text-muted">{item.shortcut}</small>
                      {/if}
                    </DropdownMenu.Item>
                  {/if}
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      {/snippet}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
  .dropdown-item:hover:not(.disabled) {
    background-color: var(--bs-light);
  }
  
  .dropdown-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>