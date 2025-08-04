<script>
  import TableInput from "./TableInput.svelte";
  import TableInputBatch from "./TableInputBatch.svelte";
  import { getRenderResult } from "./utils.js";

  let {
    items,
    columns = [],
    orderBy = $bindable(),
    direction = $bindable(),
    selected = $bindable(),
    selectable = true,
    size,
    bordered = false,
    wrap = true,
  } = $props();

  const defaultColumns = [];
  const derivedColumns = $derived([...defaultColumns, ...columns]);
</script>

<div class="table-responsive">
  <table
    class="table align-middle {size ? `table-${size}` : ''}"
    class:table-bordered={bordered}
    class:text-nowrap={!wrap}
  >
    <thead>
      <tr>
        {#if selectable}
          <th>
            <TableInputBatch bind:selected {items}></TableInputBatch>
          </th>
        {/if}
        {#each derivedColumns as header}
          <th class="fs-7 fw-normal text-black-50">
            {#if header.sortable}
              <button
                class="btn btn-link btn-sm p-0 text-black-50 link-underline link-underline-opacity-0"
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
            <th>
              <TableInput bind:selected id={item.id}></TableInput>
            </th>
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
            <td>
              {#if type === "component"}
                <Component {...props}></Component>
              {:else if type === "function"}
                {@html value}
              {:else}
                {value || cellValue}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
