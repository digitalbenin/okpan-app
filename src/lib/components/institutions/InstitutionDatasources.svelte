<script>
    import { getContext } from "svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { epochToDate } from "$lib/utils/dates";
    import SidePanel from "$lib/components/common/SidePanel.svelte";
    import DatasourceDetail from "$lib/components/datasources/DatasourceDetail.svelte";
    import {
        updateDatasource,
        getDatasource,
    } from "$lib/stores/DatasourcesUtils.js";

    // --- Use $state for reactivity ---
    let datasources = $state(getContext("datasources") || []);

    // Placeholder for search query
    let searchQuery = "";

    // Placeholder for sorting
    let sortColumn = "name"; // 'name' or 'date'
    let sortDirection = "asc"; // 'asc' or 'desc'

    // --- State for Side Panel ---
    let selectedDatasourceId = $state(null);
    let selectedDatasource = $state(null);
    let closeContentTimeout = null;

    function findDatasourceById(id) {
        // Finds from the const context array
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
            console.log(`Showing detail (URL update disabled)`);
            // Set state ONLY
            selectedDatasourceId = newDatasourceId;
            selectedDatasource = datasource;
        } else if (!newDatasourceId) {
            console.warn(`Datasource ${datasourceId} not found.`);
            closeDatasourceDetail(false);
        }
    }

    function closeDatasourceDetail(updateUrl = true) {
        console.log(`Closing detail (URL update disabled)`);
        if (selectedDatasourceId !== null) {
            const idToRemove = selectedDatasourceId;
            // Set state ONLY
            selectedDatasourceId = null;
            if (closeContentTimeout) clearTimeout(closeContentTimeout);
            closeContentTimeout = setTimeout(() => {
                if (selectedDatasourceId === null) {
                    console.log(
                        `Timeout: Removing datasource content for ID: ${idToRemove}`,
                    );
                    selectedDatasource = null;
                }
                closeContentTimeout = null;
            }, 310);
        }
    }

    async function handleDatasourceSave(event) {
        const { id, data } = event.detail;
        if (!id) {
            console.error("Cannot save: Datasource ID is missing.");
            alert("Cannot save: Datasource ID is missing.");
            return;
        }
        console.log(
            `Attempting to save datasource ${id} with comprehensive data:`,
            data,
        );

        let updateResponse = null;
        try {
            updateResponse = await updateDatasource(id, data, fetch);
        } catch (err) {
            console.error(
                "Caught detailed error during updateDatasource call:",
                err,
            );
            let alertMessage =
                "An unexpected error occurred during save. Check the developer console for details.";
            if (err && err.message) {
                alertMessage = `Error during save: ${err.message}. See console for more details.`;
            }
            if (
                err &&
                err.graphqlErrors &&
                Array.isArray(err.graphqlErrors) &&
                err.graphqlErrors.length > 0
            ) {
                const gqlErrorMsg = err.graphqlErrors[0]?.message;
                if (gqlErrorMsg) {
                    alertMessage = `GraphQL Error: ${gqlErrorMsg}. See console for full details.`;
                }
            }
            alert(alertMessage);
            return;
        }

        if (!updateResponse) {
            console.error(
                "handleDatasourceSave: updateDatasource returned null or undefined!",
            );
            alert(
                "An unexpected error occurred: Update operation did not respond correctly.",
            );
            return;
        }

        if (updateResponse.error) {
            console.error(
                "Failed to save datasource completely:",
                updateResponse.error,
            );
            alert(`Error saving datasource: ${updateResponse.error}`);
        } else {
            console.log("Save successful. Refetching single item...");
            let refetchResponse = null;
            try {
                refetchResponse = await getDatasource(id, fetch);
            } catch (err) {
                console.error(
                    "Caught error during getDatasource refetch call:",
                    err,
                );
                alert(
                    "Datasource saved, but an unexpected error occurred while refreshing the view.",
                );
                return;
            }

            if (
                !refetchResponse ||
                refetchResponse.error ||
                !refetchResponse.result
            ) {
                console.error(
                    "Failed to refetch updated datasource:",
                    refetchResponse?.error,
                );
                alert(
                    "Datasource saved, but failed to refresh view. Please close and reopen the detail panel.",
                );
            } else {
                const newlyFetchedDatasource =
                    refetchResponse.result?.[0] ?? null;

                // --- Add Logging Here ---
                console.log(
                    "[handleDatasourceSave] Refetched datasource:",
                    JSON.stringify(newlyFetchedDatasource, null, 2), // Log the whole object
                );
                if (newlyFetchedDatasource) {
                    console.log(
                        `[handleDatasourceSave] Refetched date value: ${newlyFetchedDatasource.date}, type: ${typeof newlyFetchedDatasource.date}`,
                    );
                }
                // --- End Logging ---

                // --- MODIFICATION: Update selectedDatasource directly ---
                selectedDatasource = newlyFetchedDatasource;
                console.log(
                    "Updated selectedDatasource directly (snapshot):",
                    $state.snapshot(selectedDatasource),
                );

                // --- ALSO: Update the main list for the table view ---
                // --- DIAGNOSTIC: Temporarily comment out list update ---
                // --- RE-ENABLE List Update ---
                // /*
                if (newlyFetchedDatasource) {
                    const index = datasources.findIndex((ds) => ds.id === id); // Find index (needed for logging/check)
                    if (index !== -1) {
                        console.log(
                            `[Before Map] Snapshot of datasources array:`,
                            $state.snapshot(datasources),
                        );
                        console.log(
                            `Updating main list via map + SPREAD for id ${id}`,
                        );
                        datasources = datasources.map((ds) =>
                            ds.id === id
                                ? { ...ds, ...newlyFetchedDatasource }
                                : ds,
                        );
                        console.log(
                            `[After Map] Snapshot of datasources array:`,
                            $state.snapshot(datasources),
                        );
                    } else {
                        console.warn(
                            `Datasource ${id} not found in list after refetch (map).`,
                        );
                    }
                } else {
                    datasources = datasources.filter((ds) => ds.id !== id);
                    console.log(
                        "Refetch returned null, removing from list and setting selected to null.",
                    );
                }
                // */
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

    // --- Restore derived state ---
    // COMMENT OUT $derived for now
    // let filteredAndSortedDatasources = $derived(datasources);

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
                {#if datasources.length === 0}
                    <tr>
                        <td colspan="4" class="text-center text-muted py-4">
                            {#if datasources.length === 0}
                                No data sources found for this institution.
                            {:else}
                                No data sources match your search. // Or
                                filtering message
                            {/if}
                        </td>
                    </tr>
                {:else}
                    {#each datasources as datasource (datasource.id)}
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
        <DatasourceDetail
            datasource={selectedDatasource}
            on:save={handleDatasourceSave}
        />
    {:else}
        <p>Loading...</p>
    {/if}
</SidePanel>
