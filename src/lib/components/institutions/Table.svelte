<script>
  import { queryParameters } from "sveltekit-search-params";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import {
    createColumnHelper,
    createSvelteTable,
    getCoreRowModel,
    renderComponent,
  } from "$lib/components/table";
  import FlexRender from "$lib/components/table/flex-render.svelte";
  import TableLink from "$lib/components/table/TableLink.svelte";

  let { institutions } = $props();

  const params = queryParameters({
    page: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    ["page-size"]: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 2,
    },
  });

  let state = $state({
    pagination: {
      pageIndex: params.page - 1,
      pageSize: params["page-size"],
    },
    sorting: [],
  });

  let dataState = $derived(institutions);

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
    manualPagination: false, //turn off client-side pagination
    manualSorting: false,
    // rowCount: institutions.length,
    onSortingChange: (updater) => {
      if (updater instanceof Function) {
        state.sorting = updater(state.sorting);
      } else {
        state.sorting = updater;
      }

      // update query params
      // if (state.sorting.length) {
      //   params.sort = state.sorting
      //     .map((sort) => `${sort.id}:${sort.desc ? "desc" : "asc"}`)
      //     .join(",");
      // } else {
      //   params.sort = null;
      // }
    },
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
              <div onclick={header.column.getToggleSortingHandler()}>
                <FlexRender
                  content={header.column.columnDef.header}
                  context={header.getContext()}
                />
              </div>
              {#if header.column.getIsSorted().toString() === "asc"}
                🔼
              {:else if header.column.getIsSorted().toString() === "desc"}
                🔽
              {/if}
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
          params.page--;
          state.pagination.pageIndex--;
        }}>Prev</button
      >
    </li>
    {#each Array.from({ length: table.getPageCount() }, (_, i) => i) as pageIndex}
      <li
        class="page-item"
        class:active={pageIndex === state.pagination.pageIndex}
      >
        <button
          class="page-link"
          onclick={() => {
            params.page = pageIndex + 1;
            state.pagination.pageIndex = pageIndex;
          }}>{pageIndex + 1}</button
        >
      </li>
    {/each}

    <li class="page-item" class:disabled={!table.getCanNextPage()}>
      <button
        class="page-link"
        onclick={() => {
          params.page++;
          state.pagination.pageIndex++;
        }}>Next</button
      >
    </li>
  </ul>
</nav>
