<script>
    import { getContext, onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { epochToDate } from "$lib/utils/dates";
    import SidePanel from "$lib/components/common/SidePanel.svelte";
    import DatasourceDetail from "$lib/components/datasources/DatasourceDetail.svelte";

    // Get data from context
    const datasources = getContext("datasources") || [];

    // Placeholder for search query
    let searchQuery = "";

    // Placeholder for sorting
    let sortColumn = "name"; // 'name' or 'date'
    let sortDirection = "asc"; // 'asc' or 'desc'

    // --- State for Side Panel ---
    let selectedDatasourceId = $state(null);
    let selectedDatasource = $state(null);
    let closeContentTimeout = null;
    let pageUnsubscribe;

    onMount(() => {
        pageUnsubscribe = page.subscribe((currentPage) => {
            const urlDatasourceId =
                currentPage.url.searchParams.get("datasourceId");
            const currentSelectedId = selectedDatasourceId
                ? String(selectedDatasourceId)
                : undefined;
            const currentUrlId = urlDatasourceId
                ? String(urlDatasourceId)
                : undefined;

            if (currentUrlId && currentUrlId !== currentSelectedId) {
                console.log(
                    `URL change detected: Opening/switching to datasource ${currentUrlId}`,
                );
                showDatasourceDetail(currentUrlId, false);
            } else if (!currentUrlId && currentSelectedId) {
                console.log(
                    `URL change detected: Closing datasource ${currentSelectedId}`,
                );
                closeDatasourceDetail(false);
            }
        });

        // Check initial URL state
        const initialDatasourceId = $page.url.searchParams.get("datasourceId");
        if (initialDatasourceId) {
            console.log(
                `Initial mount: Found datasourceId ${initialDatasourceId} in URL`,
            );
            showDatasourceDetail(initialDatasourceId, false);
        }
    });

    onDestroy(() => {
        if (pageUnsubscribe) pageUnsubscribe();
        if (closeContentTimeout) clearTimeout(closeContentTimeout);
    });

    function findDatasourceById(id) {
        return datasources.find((ds) => String(ds.id) === String(id)) || null;
    }

    function showDatasourceDetail(datasourceId, updateUrl = true) {
        if (closeContentTimeout) {
            clearTimeout(closeContentTimeout);
            closeContentTimeout = null;
        }
        const datasource = findDatasourceById(datasourceId);
        const newDatasourceId = datasource ? String(datasource.id) : null;

        if (newDatasourceId && newDatasourceId !== selectedDatasourceId) {
            console.log(
                `Showing datasource detail for ID: ${newDatasourceId}, updateUrl: ${updateUrl}`,
            );
            selectedDatasourceId = newDatasourceId;
            selectedDatasource = datasource;

            if (updateUrl) {
                const currentPath = $page.url.pathname;
                const currentParams = new URLSearchParams($page.url.search);
                currentParams.set("datasourceId", newDatasourceId);
                console.log(
                    `Updating URL: ${currentPath}?${currentParams.toString()}`,
                );
                goto(`${currentPath}?${currentParams.toString()}`, {
                    keepfocus: true,
                    noscroll: true,
                    replaceState: false,
                });
            }
        } else if (!newDatasourceId) {
            console.warn(`Datasource with ID ${datasourceId} not found.`);
            closeDatasourceDetail(true);
        }
    }

    function closeDatasourceDetail(updateUrl = true) {
        console.log(
            `Closing datasource detail. Current ID: ${selectedDatasourceId}, updateUrl: ${updateUrl}`,
        );
        if (selectedDatasourceId !== null) {
            const idToRemove = selectedDatasourceId;
            selectedDatasourceId = null; // Close panel immediately

            if (closeContentTimeout) clearTimeout(closeContentTimeout);
            closeContentTimeout = setTimeout(() => {
                if (selectedDatasourceId === null) {
                    // Check if still closed
                    console.log(
                        `Timeout: Removing datasource content for ID: ${idToRemove}`,
                    );
                    selectedDatasource = null;
                }
                closeContentTimeout = null;
            }, 310);

            if (updateUrl) {
                const currentPath = $page.url.pathname;
                const currentParams = new URLSearchParams($page.url.search);
                currentParams.delete("datasourceId");
                const newSearch = currentParams.toString();
                const newUrl = `${currentPath}${newSearch ? "?" + newSearch : ""}`;
                console.log(`Updating URL: ${newUrl}`);
                goto(newUrl, {
                    keepfocus: true,
                    noscroll: true,
                    replaceState: false,
                });
            }
        }
    }

    // Keyboard handler for accessible clicks
    function handleDatasourceKeyPress(event, datasourceId) {
        if (event.key === "Enter" || event.key === " ") {
            showDatasourceDetail(datasourceId);
        }
    }
    // --- End State for Side Panel ---

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
                                role="button"
                                tabindex="0"
                                onclick={() =>
                                    showDatasourceDetail(datasource.id)}
                                onkeydown={(e) =>
                                    handleDatasourceKeyPress(e, datasource.id)}
                                style="cursor: pointer;"
                            >
                                {datasource.name?.content ||
                                    "Untitled Data Source"}
                            </td><td>{epochToDate(datasource.date)}</td>
                            <td>{datasource.objectsCount}</td>
                            <td
                                class="text-end d-flex flex-row justify-content-end"
                            >
                                <BaseButton
                                    text="Edit info"
                                    icon="pencil-fill"
                                    class="btn btn-sm btn-outline-secondary text-dark me-2"
                                    onClick={() =>
                                        showDatasourceDetail(datasource.id)}
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

<!-- Side Panel for Datasource Detail -->
<SidePanel
    isOpen={!!selectedDatasourceId}
    on:close={() => closeDatasourceDetail(true)}
    position="right"
    width="500px"
    aria-labelledby="datasourceDetailTitle"
>
    <div
        slot="header"
        class="d-flex align-items-center justify-content-between"
    >
        <div class="d-flex align-items-center gap-2">
            <BaseButton
                icon="chevron-right"
                onClick={() => closeDatasourceDetail(true)}
                class="btn btn-light border-1 px-2 me-2 rounded-0 border-dark text-decoration-none text-dark"
                aria-label="Close datasource detail"
            />
            <h5 id="datasourceDetailTitle" class="mb-0 text-break">
                {selectedDatasource?.name?.content || "Datasource Detail"}
            </h5>
        </div>
    </div>
    {#if selectedDatasource}
        <DatasourceDetail datasource={selectedDatasource} />
    {:else}
        <p>Loading...</p>
        <!-- Optional: Loading state -->
    {/if}
</SidePanel>
