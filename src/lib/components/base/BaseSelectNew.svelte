<script>
  import { Select } from "bits-ui";

  let {
    value = $bindable(),
    items,
    contentProps = { width: "content" },
    portalProps,
    placeholder,
    type = "single",
    size,
    ...restProps
  } = $props();

  const selectedLabel = $derived.by(() => {
    if (!value) {
      return placeholder;
    } else {
      if (type === "multiple") {
        return items
          .filter((item) => value.includes(item.value))
          .map((item) => item.label)
          .join(", ");
      }
      return items.find((item) => item.value === value)?.label;
    }
  });

  // Group items by their group property
  const groupedItems = $derived.by(() => {
    const groups = {};
    const ungrouped = [];

    items.forEach((item) => {
      if (item.group) {
        if (!groups[item.group]) {
          groups[item.group] = [];
        }
        groups[item.group].push(item);
      } else {
        ungrouped.push(item);
      }
    });

    return { groups, ungrouped };
  });
</script>

<Select.Root bind:value {type} {...restProps}>
  <Select.Trigger
    class="form-select text-start text-truncate {restProps.inputClass} {size
      ? `form-select-${size}`
      : ''}"
  >
    {selectedLabel ? selectedLabel : placeholder}
  </Select.Trigger>
  <Select.Portal {...portalProps}>
    <Select.Content {...contentProps} align="start">
      {#snippet child({ wrapperProps, props, open })}
        {#if open}
          <div {...wrapperProps}>
            <div
              {...props}
              class="content mt-1 shadow-sm bg-white border rounded-2 z-1 p-1"
              class:anchorWidth={contentProps.width === "anchor"}
            >
              <Select.ScrollUpButton
                class="border-bottom d-flex justify-content-center"
                ><i class="bi bi-caret-up-fill"></i></Select.ScrollUpButton
              >
              <Select.Viewport>
                <!-- Render ungrouped items first -->
                {#each groupedItems.ungrouped as { value, label, disabled } (value)}
                  <Select.Item {value} {label} {disabled}>
                    {#snippet children({ selected, highlighted })}
                      <div
                        class="d-flex align-items-center justify-content-between rounded p-1 cursor-pointer"
                        class:text-bg-light={highlighted}
                        class:fs-7={size === "sm"}
                        class:fs-5={size === "lg"}
                      >
                        <div class="text-truncate">{label}</div>
                        {#if selected}
                          <i class="bi bi-check-lg"></i>
                        {/if}
                      </div>
                    {/snippet}
                  </Select.Item>
                {/each}

                <!-- Render grouped items -->
                {#each Object.entries(groupedItems.groups) as [groupName, groupItems]}
                  <Select.Group>
                    <Select.GroupHeading
                      class="px-1 text-black-50 fs-7 text-uppercase"
                    >
                      {groupName}
                    </Select.GroupHeading>
                    {#each groupItems as { value, label, disabled } (value)}
                      <Select.Item {value} {label} {disabled}>
                        {#snippet children({ selected, highlighted })}
                          <div
                            class="d-flex align-items-center justify-content-between rounded p-1 cursor-pointer ms-2"
                            class:text-bg-light={highlighted}
                            class:fs-7={size === "sm"}
                            class:fs-5={size === "lg"}
                          >
                            <div class="text-truncate">{label}</div>
                            {#if selected}
                              <i class="bi bi-check-lg"></i>
                            {/if}
                          </div>
                        {/snippet}
                      </Select.Item>
                    {/each}
                  </Select.Group>
                {/each}
                <!-- {#each items as { value, label, disabled, group } (value)}
                  <Select.Item {value} {label} {disabled}>
                    {#snippet children({ selected, highlighted })}
                      <div
                        class="d-flex align-items-center justify-content-between rounded p-1 cursor-pointer"
                        class:text-bg-light={highlighted}
                        class:fs-7={size === "sm"}
                        class:fs-5={size === "lg"}
                      >
                        <div class="text-truncate">{label}</div>
                        {#if selected}
                          <i class="bi bi-check-lg"></i>
                        {/if}
                      </div>
                    {/snippet}
                  </Select.Item>
                {/each} -->
              </Select.Viewport>
              <Select.ScrollDownButton
                class="border-top d-flex justify-content-center"
                ><i class="bi bi-caret-down-fill"></i></Select.ScrollDownButton
              >
            </div>
          </div>
        {/if}
      {/snippet}
    </Select.Content>
  </Select.Portal>
</Select.Root>

<style>
  .content {
    max-height: var(--bits-floating-available-height);
  }
  .anchorWidth {
    width: var(--bits-floating-anchor-width);
  }
</style>
