<script>
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import {
    IconCheck,
    IconChevronDown,
    IconSortAscending,
    IconSortDescending,
  } from "@tabler/icons-svelte";

  let {
    fields = [],
    orderBy = $bindable(),
    direction = $bindable("asc"),
    sortByLabel = "Sort by",
    orderLabel = "Order",
    ascendingLabel = "Ascending",
    descendingLabel = "Descending",
    triggerClass = "btn btn-outline-secondary btn-sm d-flex align-items-center gap-1",
    contentProps = { style: "right: 0; left: auto;" },
  } = $props();

  let open = $state(false);
  const currentField = $derived(fields.find((field) => field.value === orderBy) || fields[0]);

  const selectField = (value) => {
    orderBy = value;
    open = false;
  };

  const selectDirection = (value) => {
    direction = value;
    open = false;
  };
</script>

<BaseDropdownMenu
  bind:open
  {contentProps}
  side="bottom"
  align="end"
  {triggerClass}
  menuClass="px-2 py-2"
>
  {#snippet trigger()}
    {currentField?.label || sortByLabel}
    <IconChevronDown size={16} />
  {/snippet}
  {#snippet children()}
    <div class="px-2 pt-1 pb-2 fw-semibold fs-7">{sortByLabel}</div>
    {#each fields as field}
      <button
        type="button"
        class="dropdown-item rounded px-2 py-1 d-flex align-items-center gap-2"
        onclick={() => selectField(field.value)}
      >
        <span class="d-flex align-items-center justify-content-center" style="width: 14px; height: 14px;">
          {#if orderBy === field.value}
            <IconCheck size={14} />
          {:else}
            <span style="width: 14px;"></span>
          {/if}
        </span>
        <span class="flex-grow-1">{field.label}</span>
      </button>
    {/each}

    <div class="dropdown-divider my-2"></div>
    <div class="px-2 pt-1 pb-2 fw-semibold fs-7">{orderLabel}</div>
    <button
      type="button"
      class="dropdown-item rounded px-2 py-1 d-flex align-items-center gap-2"
      onclick={() => selectDirection("desc")}
    >
      <span class="d-flex align-items-center gap-1" style="width: 32px;">
        {#if direction === "desc"}<IconCheck size={14} />{:else}<span style="width: 14px;"></span>{/if}
        <IconSortDescending size={14} />
      </span>
      <span class="flex-grow-1">{descendingLabel}</span>
    </button>
    <button
      type="button"
      class="dropdown-item rounded px-2 py-1 d-flex align-items-center gap-2"
      onclick={() => selectDirection("asc")}
    >
      <span class="d-flex align-items-center gap-1" style="width: 32px;">
        {#if direction === "asc"}<IconCheck size={14} />{:else}<span style="width: 14px;"></span>{/if}
        <IconSortAscending size={14} />
      </span>
      <span class="flex-grow-1">{ascendingLabel}</span>
    </button>
  {/snippet}
</BaseDropdownMenu>
