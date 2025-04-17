<script>
    import { getContext } from "svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { epochToDate } from "$lib/utils/dates";

    // Get data from context
    const datasources = getContext("datasources") || [];

    // Placeholder for search query
    let searchQuery = "";

    // Placeholder for sorting
    let sortColumn = "name"; // 'name' or 'date'
    let sortDirection = "asc"; // 'asc' or 'desc'

    // Computed property for filtered and sorted datasources (implement actual logic later)
    let filteredAndSortedDatasources = $derived(datasources); // TODO: Add filtering and sorting

    function toggleSort(column) {
        if (sortColumn === column) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortColumn = column;
            sortDirection = "asc";
        }
        // TODO: Implement actual sorting logic based on sortColumn and sortDirection
    }
</script>

<div class="container-fluid mt-4">
    <!-- Control Row: Search -->
    <!--     <div class="d-flex justify-content-end align-items-center mb-3">
        <div class="input-group input-group-sm" style="max-width: 300px;">
            <input
                type="search"
                class="form-control"
                placeholder="Search data sources..."
                bind:value={searchQuery}
                aria-label="Search data sources"
            />
            <BaseButton
                icon="search"
                class="btn btn-outline-secondary"
                type="button"
                onClick={() => {
                    /* TODO: Implement search */
                }}
            />
        </div>
    </div>-->

    <!-- List View Table -->
    <div class="table-responsive">
        <table class="table table-hover align-middle">
            <thead>
                <tr>
                    <th
                        scope="col"
                        class="py-1"
                        style="cursor: pointer;"
                        onclick={() => toggleSort("name")}
                        aria-label="Sort by Name"
                    >
                        <span
                            class="btn btn-sm btn-dark d-inline-flex align-items-center gap-1"
                        >
                            <i class="bi bi-sort-down-alt me-1"></i>
                            Name
                        </span>
                    </th>
                    <th
                        scope="col"
                        class="py-1"
                        style="cursor: pointer;"
                        onclick={() => toggleSort("date")}
                        aria-label="Sort by Date"
                    >
                        <span
                            class="btn btn-sm btn-dark d-inline-flex align-items-center gap-1"
                        >
                            <i class="bi bi-sort-down-alt me-1"></i>
                            Date
                        </span>
                    </th>
                    <th
                        scope="col"
                        class="py-1"
                        style="cursor: pointer;"
                        onclick={() => toggleSort("objectsCount")}
                        aria-label="Sort by Objects"
                    >
                        <span
                            class="btn btn-sm btn-dark d-inline-flex align-items-center gap-1"
                        >
                            <i class="bi bi-sort-down-alt me-1"></i>
                            Objects
                        </span>
                    </th>
                    <th scope="col" class="text-end"></th>
                </tr>
            </thead>
            <tbody>
                {#if filteredAndSortedDatasources.length === 0}
                    <tr>
                        <td colspan="4" class="text-center text-muted py-4">
                            {#if datasources.length === 0}
                                No data sources found for this institution.
                                <!-- TODO: Add link/button to import? -->
                            {:else}
                                No data sources match your search.
                            {/if}
                        </td>
                    </tr>
                {:else}
                    {#each filteredAndSortedDatasources as datasource (datasource.id)}
                        <tr>
                            <td
                                >{datasource.name?.content ||
                                    "Untitled Data Source"}</td
                            >
                            <td>{epochToDate(datasource.date)}</td>
                            <td>{datasource.objectsCount}</td>
                            <td
                                class="text-end d-flex flex-row justify-content-end"
                            >
                                <BaseButton
                                    text="Edit info"
                                    icon="pencil-fill"
                                    class="btn btn-sm btn-outline-secondary text-dark me-2"
                                    onClick={() => {
                                        /* TODO: Implement edit info */
                                    }}
                                    size="sm"
                                />
                                <BaseButton
                                    text="Modify mapping"
                                    icon="link-45deg"
                                    class="btn btn-sm btn-outline-secondary text-dark"
                                    onClick={() => {
                                        /* TODO: Implement modify mapping */
                                    }}
                                    size="sm"
                                />
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
</div>
