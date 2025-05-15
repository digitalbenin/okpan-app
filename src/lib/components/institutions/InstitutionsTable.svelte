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
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import IndeterminateCheckbox from "$lib/components/table/IntermediateCheckbox.svelte";
  import { deleteInstitution } from "$lib/stores/InstitutionsUtils.js";
  import BaseModal from "$lib/components/base/BaseModal.svelte";

  let { institutions, count } = $props();

  const params = queryParameters();

  let sortingState = $derived([
    { id: params.iOrderBy, desc: params.iDirection === "desc" },
  ]);

  let paginationState = $derived({
    pageIndex: params.iPage - 1,
    pageSize: params.iPageSize,
  });

  let rowSelectionState = $state({});

  // State for modal
  let showDeleteModal = $state(false);
  let institutionToDeleteId = $state(null);

  function nextPage() {
    table.nextPage();
  }
  function previousPage() {
    table.previousPage();
  }
  function goToPage(pageIndex) {
    table.setPageIndex(pageIndex);
  }

  const colHelp = createColumnHelper();

  const columnDefs = [
    colHelp.accessor((row) => row.id, {
      id: "select",
      header: ({ table }) => {
        return renderComponent(IndeterminateCheckbox, {
          checked: table.getIsAllRowsSelected(),
          indeterminate: table.getIsSomeRowsSelected(),
          onchange: table.getToggleAllRowsSelectedHandler(),
        });
      },
      cell: ({ row }) => {
        return renderComponent(IndeterminateCheckbox, {
          checked: row.getIsSelected(),
          disabled: !row.getCanSelect(),
          indeterminate: row.getIsSomeSelected(),
          onchange: row.getToggleSelectedHandler(),
        });
      },
    }),
    colHelp.accessor((row) => row.name.content + " - " + row.country.content, {
      id: "name",
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
    colHelp.display({
      id: "actions",
      header: null, // No header for this column
      cell: ({ row }) => {
        return renderComponent(BaseButton, {
          text: "Delete",
          icon: "trash",
          class: "btn btn-danger btn-sm",
          onClick: async () => {
            // Call the delete function with the institution ID
            console.log("Deleting institution:", row.original.id);
            confirmDelete(row.original.id);
          },
        });
      },
    }),
  ];

  const table = createSvelteTable({
    get data() {
      return institutions;
    },
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, //turn off client-side pagination
    manualSorting: true,
    enableRowSelection: true,
    get rowCount() {
      return count;
    },
    enableSortingRemoval: false,
    getRowId: (row) => row.id,
    onPaginationChange: (updater) => {
      let pagination = {
        pageIndex: paginationState.pageIndex,
        pageSize: paginationState.pageSize,
      };
      if (updater instanceof Function) {
        pagination = updater(pagination);
      } else {
        pagination = updater;
      }

      if (pagination) {
        params.iPage = pagination.pageIndex + 1;
        params.iPageSize = pagination.pageSize;
      }
    },
    onSortingChange: (updater) => {
      let sorting = [
        {
          id: sortingState[0].id,
          desc: sortingState[0].desc,
        },
      ];
      if (updater instanceof Function) {
        sorting = updater(sorting);
      } else {
        sorting = updater;
      }

      if (sorting.length) {
        params.iOrderBy = sorting[0].id;
        params.iDirection = sorting[0].desc ? "desc" : "asc";
      }
    },
    onRowSelectionChange: (updater) => {
      if (updater instanceof Function) {
        rowSelectionState = updater(rowSelectionState);
      } else {
        rowSelectionState = updater;
      }
    },
    state: {
      get pagination() {
        return paginationState;
      },
      get sorting() {
        return sortingState;
      },
      get rowSelection() {
        return rowSelectionState;
      },
    },
  });

  // Function to open the confirmation modal
  function confirmDelete(institutionId) {
    institutionToDeleteId = institutionId;
    showDeleteModal = true;
  }

  // Function to handle the actual deletion after confirmation
  async function handleConfirmDelete() {
    if (institutionToDeleteId) {
      console.log("Confirmed deletion for:", institutionToDeleteId);
      await deleteInstitution(institutionToDeleteId);
      // TODO: The parent component needs to refetch the data to refresh the table
      // after a successful deletion, as this component doesn't have access to the loading function.
      showDeleteModal = false;
      institutionToDeleteId = null;
    }
  }
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
              {#if header.id !== "select" && header.id !== "actions"}
                <button
                  onclick={header.column.getToggleSortingHandler()}
                  class="btn btn-dark btn-sm d-flex align-items-center"
                >
                  <FlexRender
                    content={header.column.columnDef.header}
                    context={header.getContext()}
                  />
                  {#if header.column.getIsSorted()}
                    <i
                      class="ms-1 bi bi-sort-alpha-{header.column
                        .getIsSorted()
                        .toString() === 'asc'
                        ? 'down'
                        : 'up'}"
                    ></i>
                  {:else}
                    <i class="ms-1 bi bi-dash"></i>
                  {/if}
                </button>
              {:else}
                <FlexRender
                  content={header.column.columnDef.header}
                  context={header.getContext()}
                />
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
{#if institutions.length !== count && params.iPageSize}
  <nav aria-label="pagination">
    <ul class="pagination pagination-sm">
      <li class="page-item" class:disabled={!table.getCanPreviousPage()}>
        <button class="page-link" onclick={() => previousPage()}>Prev</button>
      </li>
      {#each Array.from({ length: Math.ceil(count / paginationState.pageSize) }, (_, i) => i) as pageIndex}
        <li
          class="page-item"
          class:active={pageIndex === paginationState.pageIndex}
        >
          <button
            class="page-link"
            onclick={() => {
              goToPage(pageIndex);
            }}>{pageIndex + 1}</button
          >
        </li>
      {/each}

      <li class="page-item" class:disabled={!table.getCanNextPage()}>
        <button
          class="page-link"
          onclick={() => {
            nextPage();
          }}>Next</button
        >
      </li>
    </ul>
  </nav>
{/if}

<!-- Delete Confirmation Modal -->
<BaseModal bind:isOpen={showDeleteModal}>
  {#snippet header()}
    Confirm Deletion
  {/snippet}

  {#snippet body()}
    <p>Are you sure you want to delete this institution?</p>
    <p>
      All related data (objects, assets, datasources, etc.) will also be
      permanently deleted.
    </p>
  {/snippet}

  {#snippet actions()}
    <BaseButton
      text="Cancel"
      class="btn btn-secondary"
      onClick={() => (showDeleteModal = false)}
    />
    <BaseButton
      text="Delete"
      class="btn btn-danger"
      onClick={handleConfirmDelete}
    />
  {/snippet}
</BaseModal>
