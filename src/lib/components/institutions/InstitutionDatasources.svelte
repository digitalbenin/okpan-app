<script>
    import { getContext } from "svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import { epochToDate } from "$lib/utils/dates";
    import SidePanel from "$lib/components/common/SidePanel.svelte";
    import DatasourceDetail from "$lib/components/datasources/DatasourceDetail.svelte";
    import BaseModal from "$lib/components/base/BaseModal.svelte";
    import DatasourceMapping from "$lib/components/datasources/DatasourceMapping.svelte";
    import {
        updateDatasource,
        getDatasource,
        deleteDatasource,
    } from "$lib/stores/DatasourcesUtils.js";

    let datasources = $state(getContext("datasources") || []);

    let sortColumn = "name"; // 'name' or 'date'
    let sortDirection = "asc"; // 'asc' or 'desc'

    let selectedDatasourceId = $state(null);
    let selectedDatasource = $state(null);
    let closeContentTimeout = null;

    // Modal state for datasource deletion
    let isDeleteDatasourceModalOpen = $state(false);
    let datasourceIdToDelete = $state(null);

    // State for Datasource Mapping SidePanel
    let isMappingPanelOpen = $state(false);
    let mappingDatasource = $state(null); // Datasource for which mapping is being viewed/edited
    let preparedMappings = $state([]);

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

    function closeDatasourceDetail() {
        console.log(`Closing detail (URL update disabled)`);
        if (selectedDatasourceId !== null) {
            const idToRemove = selectedDatasourceId;
            // Set state ONLY
            selectedDatasourceId = null;
            if (closeContentTimeout) clearTimeout(closeContentTimeout);
            closeContentTimeout = setTimeout(() => {
                if (selectedDatasourceId === null) {
                    selectedDatasource = null;
                }
                closeContentTimeout = null;
            }, 310);
        }
    }

    // Function to prepare mappings for the DatasourceMapping component
    async function prepareAndShowMappings(datasourceId) {
        isMappingPanelOpen = true; // Open panel early, show loading state
        mappingDatasource = null; // Reset previous
        preparedMappings = []; // Reset previous

        const { result: ds, error } = await getDatasource(datasourceId, fetch); // Use fetch from SvelteKit

        if (error || !ds) {
            console.error(
                `Error fetching datasource ${datasourceId} for mapping:`,
                error,
            );
            // Optionally, show an error message in the panel
            mappingDatasource = { name: { content: "Error loading" } }; // Basic error display
            isMappingPanelOpen = true; // Ensure it's open to show error or becomes visible
            return;
        }

        console.log(
            "Fetched datasource data for mapping panel:",
            JSON.stringify(ds, null, 2),
        );

        const datasourceObject = ds && ds.length > 0 ? ds[0] : null;

        if (!datasourceObject) {
            console.error(
                `Error: Datasource object not found in response from getDatasource for ID ${datasourceId}.`,
            );
            mappingDatasource = {
                name: { content: "Error: Data unavailable" },
            };
            preparedMappings = [];
            isMappingPanelOpen = true;
            return;
        }

        mappingDatasource = datasourceObject;
        console.log(
            "Using datasource object:",
            JSON.stringify(datasourceObject, null, 2),
        );

        // --- Refined mapping preparation logic ---
        if (
            datasourceObject.objectsOntologyFields &&
            datasourceObject.objectsOntologyFields.length > 0
        ) {
            const mappingsMap = new Map();

            for (const oof of datasourceObject.objectsOntologyFields) {
                const institutionField = oof.label || "Unknown Field";
                const ontologyFieldName =
                    oof.ontologyField?.name?.content || "Unlinked";
                const mappingKey = `${institutionField}:::${ontologyFieldName}`; // Composite key for grouping

                if (!mappingsMap.has(mappingKey)) {
                    mappingsMap.set(mappingKey, {
                        id: oof.id, // Use first oof.id for this group; consider if a more stable group ID is needed
                        institutionField: institutionField,
                        previewValues: [],
                        ontologyFieldName: ontologyFieldName,
                        isPrimary: !!oof.primary, // Take primary status from first encountered oof in group
                        // This might need adjustment if multiple oofs in a group can have different primary statuses
                    });
                }

                const existingMapping = mappingsMap.get(mappingKey);
                if (oof.value && existingMapping.previewValues.length < 5) {
                    existingMapping.previewValues.push(oof.value);
                }
                // If an oof with primary=true is found, this group becomes primary.
                if (oof.primary) {
                    existingMapping.isPrimary = true;
                }
            }
            preparedMappings = Array.from(mappingsMap.values());
        } else {
            preparedMappings = [];
        }
        // --- End of refined mapping preparation logic ---
    }

    function closeMappingPanel() {
        isMappingPanelOpen = false;
        // mappingDatasource = null; // Optional: clear if not needed when panel is closed
        // preparedMappings = [];
    }

    async function handleUpdateMappingPrimary(event) {
        const { id, primary } = event.detail;
        console.log(
            `TODO: Update primary status for mapping ID ${id} to ${primary}`,
        );
        // Find the mapping in preparedMappings and update its state for immediate UI feedback
        const mappingIndex = preparedMappings.findIndex((m) => m.id === id);
        if (mappingIndex !== -1) {
            // Create a new array with the updated item for reactivity
            const updatedMappings = [...preparedMappings];
            updatedMappings[mappingIndex] = {
                ...updatedMappings[mappingIndex],
                isPrimary: primary,
            };
            preparedMappings = updatedMappings;

            // TODO: Here we would call a utility function to persist this change to the backend,
            // similar to `updateDatasource`. It would likely take `id` (of objects_ontology_fields)
            // and the new `primary` status.
            // e.g., await updateObjectsOntologyFieldPrimary(id, primary);
            // And then potentially refetch or update local state more formally.
        }
    }

    async function handleDatasourceSave(event) {
        const { id, data } = event.detail;
        if (!id) {
            return;
        }

        let updateResponse = null;
        try {
            updateResponse = await updateDatasource(id, data, fetch);
        } catch (err) {
            console.error(
                "Caught detailed error during updateDatasource call:",
                err,
            );
            return;
        }
        if (!updateResponse) return;
        if (updateResponse.error) {
            console.error(
                "Failed to save datasource completely:",
                updateResponse.error,
            );
        } else {
            let refetchResponse = null;
            try {
                refetchResponse = await getDatasource(id, fetch);
            } catch (err) {
                console.error(
                    "Caught error during getDatasource refetch call:",
                    err,
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
            } else {
                const newlyFetchedDatasource =
                    refetchResponse.result?.[0] ?? null;

                selectedDatasource = newlyFetchedDatasource;
                if (newlyFetchedDatasource) {
                    const index = datasources.findIndex((ds) => ds.id === id); // Find index (needed for logging/check)
                    if (index !== -1) {
                        datasources = datasources.map((ds) =>
                            ds.id === id
                                ? { ...ds, ...newlyFetchedDatasource }
                                : ds,
                        );
                    } else {
                        console.warn(
                            `Datasource ${id} not found in list after refetch (map).`,
                        );
                    }
                } else {
                    datasources = datasources.filter((ds) => ds.id !== id);
                }
            }
        }
    }

    // Request handler from child component to open modal
    function handleDatasourceDeleteRequest(datasourceId) {
        if (datasourceId) {
            datasourceIdToDelete = datasourceId;
            isDeleteDatasourceModalOpen = true;
        } else {
            console.error("Delete request received without Datasource ID.");
        }
    }

    // Function called when deletion is confirmed in the modal
    async function confirmDatasourceDelete() {
        if (!datasourceIdToDelete) {
            console.error(
                "Cannot confirm delete: datasourceIdToDelete is null",
            );
            isDeleteDatasourceModalOpen = false;
            return;
        }

        const result = await deleteDatasource(datasourceIdToDelete);

        if (result.error) {
            console.error("Error deleting datasource:", result.error);
            alert(`Error deleting datasource: ${result.error}`); // Optional alert
        } else {
            console.log("Datasource deleted successfully:", result);
            // Remove from local list
            datasources = datasources.filter(
                (ds) => ds.id !== datasourceIdToDelete,
            );
            // Close the detail panel
            closeDatasourceDetail(true);
        }

        // Reset modal state
        isDeleteDatasourceModalOpen = false;
        datasourceIdToDelete = null;
    }

    // Keyboard handler for accessible clicks
    function handleDatasourceKeyPress(event, datasourceId) {
        if (event.key === "Enter" || event.key === " ") {
            showDatasourceDetail(datasourceId);
        }
    }

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
                                        prepareAndShowMappings(datasource.id);
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
            onDeleteRequest={handleDatasourceDeleteRequest}
        />
    {:else}
        <p>Loading...</p>
    {/if}
</SidePanel>

<!-- Side Panel for Datasource Mapping -->
<SidePanel
    isOpen={isMappingPanelOpen}
    on:close={closeMappingPanel}
    position="right"
    width="900px"
    aria-labelledby="datasourceMappingPanelTitle"
>
    <div
        slot="header"
        class="d-flex align-items-center justify-content-between"
    >
        <div class="d-flex align-items-center gap-2">
            <BaseButton
                icon="chevron-right"
                onClick={closeMappingPanel}
                class="btn btn-light border-1 px-2 me-2 rounded-0 border-dark text-decoration-none text-dark"
                aria-label="Close mapping panel"
            />
            <h5 id="datasourceMappingPanelTitle" class="mb-0 text-break">
                Field Mappings
            </h5>
        </div>
    </div>
    {#if mappingDatasource && preparedMappings}
        <DatasourceMapping
            mappings={preparedMappings}
            on:updateMappingPrimary={handleUpdateMappingPrimary}
        />
    {:else if !mappingDatasource}
        <p class="p-3 text-muted">Select a datasource to see its mappings.</p>
    {:else}
        <p class="p-3">Loading mappings...</p>
    {/if}
</SidePanel>

{#snippet header()}
    Confirm Deletion
{/snippet}

{#snippet body()}
    Are you sure you want to delete this data source? This action cannot be
    undone.
{/snippet}

{#snippet actions()}
    <div class="d-flex justify-content-end gap-2">
        <BaseButton
            text="Cancel"
            class="btn btn-secondary btn-sm"
            onClick={() => {
                isDeleteDatasourceModalOpen = false;
                datasourceIdToDelete = null;
            }}
        />
        <BaseButton
            text="Confirm Delete"
            class="btn btn-danger btn-sm"
            onClick={confirmDatasourceDelete}
        />
    </div>
{/snippet}

<!-- Render the datasource delete modal -->
{#if isDeleteDatasourceModalOpen}
    <BaseModal
        bind:isOpen={isDeleteDatasourceModalOpen}
        size="md"
        {header}
        {body}
        {actions}
    />
{/if}
