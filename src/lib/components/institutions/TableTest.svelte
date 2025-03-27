<script>
  import {
    createColumnHelper,
    createSvelteTable,
    getCoreRowModel,
    renderComponent,
  } from "$lib/components/table";
  import FlexRender from "$lib/components/table/flex-render.svelte";
  import TableLink from "$lib/components/table/TableLink.svelte";

  let { institutions } = $props();

  let state = $state({
    pagination: {
      pageIndex: 0,
      pageSize: 1,
    },
  });
  let dataState = $derived([institutions[state.pagination.pageIndex]]);

  const colHelp = createColumnHelper();

  const columnDefs = [
    colHelp.accessor("name.content", {
      header: "Name",
      cell: ({ cell, row }) =>
        renderComponent(TableLink, {
          text: cell.getValue(),
          row: row.original,
        }),
    }),
    colHelp.accessor("objectsCount", { header: "Objects" }),
    colHelp.accessor("assetsCount", { header: "Assets" }),
  ];

  const table = createSvelteTable({
    get data() {
      return dataState;
    },
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, //turn off client-side pagination
    rowCount: institutions.length,
    get state() {
      return state;
    },
  });
</script>

<div class="table-responsive">
  <table class="table">
    <thead>
      <tr>
        {#each table.getHeaderGroups() as headerGroup}
          {#each headerGroup.headers as header}
            <th>
              <FlexRender
                content={header.column.columnDef.header}
                context={header.getContext()}
              />
            </th>
          {/each}
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each table.getRowModel().rows as row}
        <tr>
          {#each row.getVisibleCells() as cell}
            <td>
              <FlexRender
                content={cell.column.columnDef.cell}
                context={cell.getContext()}
              />
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
<nav aria-label="pagination">
  <ul class="pagination pagination-sm">
    <li class="page-item" class:disabled={!table.getCanPreviousPage()}>
      <button
        class="page-link"
        onclick={() => {
          state.pagination.pageIndex--;
        }}>Prev</button
      >
    </li>
    {#each Array.from({ length: table.getPageCount() }, (_, i) => i) as page}
      <li
        class="page-item"
        class:active={page === table.getState().pagination.pageIndex}
      >
        <button
          class="page-link"
          onclick={() => {
            state.pagination.pageIndex = page;
          }}>{page + 1}</button
        >
      </li>
    {/each}

    <li class="page-item" class:disabled={!table.getCanNextPage()}>
      <button
        class="page-link"
        onclick={() => {
          state.pagination.pageIndex++;
        }}>Next</button
      >
    </li>
  </ul>
</nav>
