<script>
  import TableInput from "./TableInput.svelte";
  import TableInputBatch from "./TableInputBatch.svelte";
  import { getRenderResult } from "./utils.js";

  let {
    items,
    columns = [],
    orderBy = $bindable(),
    direction = $bindable(),
    selected = $bindable([]),
    selectable = true,
    size,
    transparent = false,
    headerClass = "fs-7 fw-normal",
    bordered = false,
    wrap = true,
    cellClass = "",
    cellContentClass = "",
    cellContentStyle = "",
  } = $props();

  const defaultColumns = [];
  const derivedColumns = $derived([...defaultColumns, ...columns]);
</script>

<div class="table-responsive-lg">
  <table
    class="table align-middle {size ? `table-${size}` : ''}"
    class:table-bordered={bordered}
    class:text-nowrap={!wrap}
    style="--bs-table-bg: {transparent ? 'transparent' : 'white'};"
  >
    <thead>
      <tr>
        {#if selectable}
          <th>
            <TableInputBatch bind:selected {items}></TableInputBatch>
          </th>
        {/if}
        {#each derivedColumns as header}
          <th class={headerClass}
            class:text-nowrap={header.nowrap}
          >
            {#if header.sortable}
              <button
                class="btn btn-link text-dark btn-sm p-0 link-underline link-underline-opacity-0"
                onclick={() => {
                  if (orderBy === header.value) {
                    direction = direction === "asc" ? "desc" : "asc";
                  } else {
                    orderBy = header.value;
                    direction = "asc";
                  }
                }}
              >
                {header.label}
                {#if orderBy === header.value}
                  <i
                    class="ms-1 bi bi-caret-{direction === 'asc'
                      ? 'down'
                      : 'up'}-fill"
                  ></i>
                {:else}
                  <i class="ms-1 bi bi-dash"></i>
                {/if}
              </button>
            {:else}
              {header.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each items as item, i}
        <tr>
          {#if selectable}
            <td>
              <TableInput bind:selected id={item.id}></TableInput>
            </td>
          {/if}
          {#each derivedColumns as header, i}
            {@const cellValue = header.accessor
              ? header.accessor(item)
              : item[header.value]}
            {@const {
              type,
              value,
              component: Component,
              props,
            } = getRenderResult(header, cellValue, item)}
            <td class="{cellClass}" class:text-nowrap={header.nowrap}>
              <div class={cellContentClass} style={cellContentStyle}>
                {#if type === "component"}
                  <Component {...props}></Component>
                {:else if type === "function" || header.html}
                  {@html value}
                {:else}
                  {value || cellValue}
                {/if}
              </div>
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
