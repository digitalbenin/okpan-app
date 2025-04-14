<script>
  import { queryParameters } from "sveltekit-search-params";
  import {
    createColumnHelper,
    createSvelteTable,
    getCoreRowModel,
    renderComponent,
  } from "$lib/components/table";
  import FlexRender from "$lib/components/table/flex-render.svelte";
  import TableLink from "$lib/components/table/TableLink.svelte";
  import BaseBadge from "$lib/components/base/BaseBadge.svelte";

  let { institutions, count } = $props();

  const params = queryParameters({
    page: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    ["page-size"]: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
  });

  let state = $state({
    pagination: {
      pageIndex: params.page - 1,
      pageSize: params["page-size"],
    },
    sorting: [],
  });

  const colHelp = createColumnHelper();

  const columnDefs = [
    colHelp.accessor((row) => row.name.content + " - " + row.country.content, {
      header: "Name",
      cell: ({ cell, row }) =>
        renderComponent(TableLink, {
          text: cell.getValue(),
          row: row.original,
        }),
    }),
    colHelp.accessor("objectsCount", { header: "Objects" }),
    colHelp.accessor("assetsCount", { header: "Assets" }),
    colHelp.accessor("status", {
      header: "Status",
      cell: ({ cell }) => {
        const status = cell.getValue();
        if (status === "in progress") {
          return renderComponent(BaseBadge, {
            text: "In progress",
            class: "bg-warning text-dark",
          });
        } else if (status === "completed") {
          return renderComponent(BaseBadge, {
            text: "Completed",
            class: "bg-success",
          });
        }
        return status;
      },
    }),
  ];

  const table = createSvelteTable({
    get data() {
      return institutions;
    },
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: false, //turn off client-side pagination
    manualSorting: false,
    rowCount: count,
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
  <table
    class="table"
    style="border-collapse: separate; border-spacing: 0 5px;"
  >
    <thead>
      <tr>
        {#each table.getHeaderGroups() as headerGroup}
          {#each headerGroup.headers as header}
            <th class="border-0">
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
        <tr style="border-radius: 8px; overflow: hidden;">
          {#each row.getVisibleCells() as cell, i}
            <td
              style="{i === 0
                ? 'border-top-left-radius: 8px; border-bottom-left-radius: 8px; border-left: 1px solid #dee2e6;'
                : 'border-left: none;'} 
                      {i === row.getVisibleCells().length - 1
                ? 'border-top-right-radius: 8px; border-bottom-right-radius: 8px; border-right: 1px solid #dee2e6;'
                : 'border-right: none;'} 
                      padding: 12px 16px; font-weight: normal; border-top: 1px solid #dee2e6; border-bottom: 1px solid #dee2e6;"
            >
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
