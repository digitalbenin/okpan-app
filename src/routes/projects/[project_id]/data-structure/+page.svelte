<script>
    import BaseInput from "$lib/components/base/BaseInput.svelte"; // Keep for structure
    import SidePanel from "$lib/components/common/SidePanel.svelte"; // Added
    import ResearchFieldDetail from "$lib/components/research_fields/ResearchFieldDetail.svelte"; // Added

    import {
        updateResearchField,
        getResearchFieldById,
        deleteResearchField,
    } from "$lib/stores/ResearchFieldsUtils.js";
    import BaseButton from "$lib/components/base/BaseButton.svelte";

    let { data } = $props(); // Access data loaded from +page.js
    // $inspect(data); // Keep inspect if helpful for debugging

    // --- Local Reactive State for Research Fields ---
    let localResearchFields = $derived(data.researchFields || []);

    // --- State for Search --- (uses localResearchFields now via filteredResearchFields)
    let researchSearchTerm = $state("");
    let ontologySearchTerm = $state("");

    // --- Filtered Research Fields (Derived State) --- Uses local state now
    const filteredResearchFields = $derived.by(() => {
        const searchTerm = researchSearchTerm.toLowerCase();
        if (!searchTerm) return localResearchFields; // Use local state
        return localResearchFields.filter(
            (
                field, // Use local state
            ) => field.name?.content?.toLowerCase().includes(searchTerm),
        );
    });

    // --- Group Ontology Fields (Derived State) ---
    const groupedOntologyFields = $derived.by(() => {
        const groups = {};
        const fields = data.ontologyFields || []; // Read directly from reactive prop
        for (const field of fields) {
            const category = field.category?.content || "Uncategorized";
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(field);
        }
        return groups;
    });

    // --- Filtered Ontology Fields (Derived State) ---
    const filteredOntologyGroups = $derived.by(() => {
        const searchTerm = ontologySearchTerm.toLowerCase();
        if (!searchTerm) return groupedOntologyFields; // Return all groups if search is empty

        const filteredGroups = {};
        for (const [category, fields] of Object.entries(
            groupedOntologyFields,
        )) {
            const filteredFields = fields.filter((field) =>
                field.name?.content?.toLowerCase().includes(searchTerm),
            );
            if (filteredFields.length > 0) {
                filteredGroups[category] = filteredFields;
            }
        }
        return filteredGroups;
    });

    // --- State for Research Field Detail --- Added ---
    let selectedResearchFieldId = $state(null);
    let selectedResearchField = $state(null);
    let isLoadingDetail = $state(false); // Added for loading state
    let closeContentTimeout = $state(null); // Reuse timeout logic pattern

    // --- Uses local state now ---
    function findResearchFieldById(id) {
        return (
            localResearchFields?.find((rf) => String(rf.id) === String(id)) || // Use local state
            null
        );
    }

    async function showResearchFieldDetail(fieldId) {
        // Made async
        if (closeContentTimeout) {
            clearTimeout(closeContentTimeout);
            closeContentTimeout = null;
        }
        // Find by ID in the current list primarily for ID validation,
        // but the full fetch will get the complete data.
        const initialFieldCheck = findResearchFieldById(fieldId);
        const newFieldId = initialFieldCheck
            ? String(initialFieldCheck.id)
            : null;

        if (newFieldId && newFieldId !== selectedResearchFieldId) {
            console.log(`Fetching research field detail for ${newFieldId}`);
            selectedResearchFieldId = newFieldId;
            selectedResearchField = null; // Clear previous field data
            isLoadingDetail = true;

            try {
                const response = await getResearchFieldById(newFieldId, fetch);
                if (response && response.result && response.result.length > 0) {
                    selectedResearchField = response.result[0]; // Assign fetched detailed data
                    console.log(
                        "Fetched details snapshot:",
                        $state.snapshot(selectedResearchField),
                    );
                } else if (response && response.error) {
                    console.error(
                        `Error fetching research field ${newFieldId}:`,
                        response.error,
                    );
                    selectedResearchField = null;
                    // Optionally, keep panel open with error or close it
                    // For now, it stays open but empty/shows error if component handles it
                } else {
                    console.warn(
                        `Research field ${newFieldId} not found via getResearchFieldById or empty result.`,
                    );
                    selectedResearchField = null;
                }
            } catch (err) {
                console.error(
                    `Exception fetching research field ${newFieldId}:`,
                    err,
                );
                selectedResearchField = null;
            } finally {
                isLoadingDetail = false;
            }
        } else if (newFieldId && newFieldId === selectedResearchFieldId) {
            // Field already selected, do nothing or maybe re-focus panel
            console.log(`Field ${newFieldId} is already selected.`);
        } else if (!newFieldId) {
            console.warn(
                `Research field with ID ${fieldId} not found in local list.`,
            );
            closeResearchFieldDetail(); // Close if not found initially
        }
    }

    function closeResearchFieldDetail() {
        console.log(`Closing research field detail`);
        if (selectedResearchFieldId !== null) {
            selectedResearchFieldId = null; // Clear ID first
            if (closeContentTimeout) clearTimeout(closeContentTimeout);
            // Delay clearing the data to allow fade-out transition
            closeContentTimeout = setTimeout(() => {
                if (selectedResearchFieldId === null) {
                    selectedResearchField = null;
                }
                closeContentTimeout = null;
            }, 310); // Match SidePanel transition
        }
    }

    async function handleResearchFieldSave(event) {
        const { id, data: fieldData } = event.detail;
        if (!id) {
            console.error("Save event missing research field ID.");
            return;
        }
        console.log("Attempting to save research field:", id, fieldData);

        try {
            const updateResponse = await updateResearchField(
                id,
                fieldData,
                fetch, // Note: fetch might not be used by actual executeQuery
            );
            if (!updateResponse || updateResponse.error) {
                console.error(
                    "Failed to save research field:",
                    updateResponse?.error,
                );
                // Optionally show user feedback
            } else {
                console.log("Research field saved successfully, refetching...");
                const refetchResponse = await getResearchFieldById(id, fetch); // Use getById
                if (
                    !refetchResponse ||
                    refetchResponse.error ||
                    !refetchResponse.result
                ) {
                    console.error(
                        "Failed to refetch updated research field:",
                        refetchResponse?.error,
                    );
                } /* else {
                    const newlyFetchedField =
                        refetchResponse.result?.[0] ?? null;
                    if (newlyFetchedField) {
                        // --- Update local reactive state ---
                        localResearchFields = localResearchFields.map((rf) =>
                            rf.id === id ? { ...rf, ...newlyFetchedField } : rf,
                        );
                        // --- End update ---

                        // Update the selected field if it's the one being edited
                        if (selectedResearchFieldId === id) {
                            selectedResearchField = newlyFetchedField;
                        }
                        console.log("Local research field state updated.");
                    } else {
                        console.warn(
                            `Refetch successful but field ${id} not found in result.`,
                        );
                        // Remove from local state if not found after refetch
                        localResearchFields = localResearchFields.filter(
                            (rf) => rf.id !== id,
                        );
                        if (selectedResearchFieldId === id)
                            closeResearchFieldDetail();
                    }
                }*/
            }
        } catch (err) {
            console.error(
                "Error during research field save/refetch process:",
                err,
            );
            // Optionally show user feedback
        }

        closeResearchFieldDetail();
    }

    async function handleResearchFieldDelete(event) {
        const { id } = event.detail;
        if (!id) {
            console.error("Delete event missing research field ID.");
            return;
        }
        console.log("Attempting to delete research field:", id);
        try {
            const deleteResponse = await deleteResearchField(id, fetch); // fetch might not be used
            if (!deleteResponse || deleteResponse.error) {
                console.error(
                    "Failed to delete research field:",
                    deleteResponse?.error,
                );
                // Optionally show user feedback
            } else {
                // --- End update ---
                closeResearchFieldDetail(); // Close panel after successful delete
            }
        } catch (err) {
            console.error("Error during research field deletion:", err);
            // Optionally show user feedback
            closeResearchFieldDetail();
        }
    }
    // --- End Added Section ---

    // TODO: Implement actual edit/info actions
    function editField(fieldId) {
        // console.log("Edit field:", fieldId); // Replaced
        showResearchFieldDetail(fieldId); // Updated
    }
    function showInfo(field) {
        console.log("Show info for field snapshot:", $state.snapshot(field));
    }
</script>

<!-- Applying Bootstrap utility classes -->
<div class="container-fluid p-4">
    <section class="mb-4">
        <header class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h2 mb-0">Research fields</h2>
            <div class="col-3">
                <!-- Using col-3 for search width -->
                <BaseInput
                    type="search"
                    placeholder="Search..."
                    bind:value={researchSearchTerm}
                />
            </div>
        </header>
        <div class="d-flex flex-wrap gap-2">
            {#each filteredResearchFields as field (field.id)}
                <div
                    class="border rounded p-2 d-flex flex-row justify-content-between align-items-center bg-light text-dark"
                    style="min-width: 200px;"
                >
                    <span class="flex-grow-1 me-2"
                        >{field.name?.content || "Unnamed Field"}</span
                    >
                    <div class="d-flex gap-1">
                        <BaseButton
                            text=""
                            icon="info-circle"
                            class="btn btn-link text-dark text-decoration-none p-1 text-secondary lh-1"
                            title={field.description?.content ||
                                "No description"}
                            onClick={() => showInfo(field)}
                        />
                        <BaseButton
                            text=""
                            icon="pencil"
                            class="btn btn-link text-dark text-decoration-none p-1 text-secondary lh-1"
                            title="Edit field"
                            onClick={() => editField(field.id)}
                        />
                    </div>
                </div>
            {:else}
                <p class="text-muted">
                    {#if researchSearchTerm}
                        No research fields match your search criteria.
                    {:else}
                        No research fields found for this project.
                    {/if}
                </p>
            {/each}
        </div>
    </section>

    <hr class="my-4" />

    <section class="mb-4">
        <header class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h2 mb-0">Default fields</h2>
            <div class="col-3">
                <BaseInput
                    type="search"
                    placeholder="Search..."
                    bind:value={ontologySearchTerm}
                />
            </div>
        </header>
        {#if Object.keys(filteredOntologyGroups).length === 0}
            <p class="text-muted">
                {#if ontologySearchTerm}
                    No default fields match your search criteria.
                {:else}
                    No default fields found.
                {/if}
            </p>
        {:else}
            {#each Object.entries(filteredOntologyGroups) as [category, fields] (category)}
                <div class="mb-3">
                    <h6 class="h6 text-secondary mt-4 mb-2 pb-1">
                        {category}
                    </h6>
                    <div class="d-flex flex-wrap gap-2">
                        {#each fields as field (field.id)}
                            <div
                                class="border rounded p-2 d-flex flex-row justify-content-between align-items-center bg-light text-dark"
                                style="min-width: 200px;"
                            >
                                <span class="flex-grow-1 me-2"
                                    >{field.name?.content ||
                                        "Unnamed Field"}</span
                                >
                                <div class="d-flex gap-1">
                                    <BaseButton
                                        text=""
                                        icon="info-circle"
                                        class="btn btn-link text-dark text-decoration-none p-1 text-secondary lh-1"
                                        title={field.description?.content ||
                                            "No description"}
                                        onClick={() => showInfo(field)}
                                    />
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        {/if}
    </section>
</div>

<!-- Side Panel for Research Field Detail -->
<SidePanel
    title="Research Field Details"
    isOpen={!!selectedResearchFieldId}
    on:close={closeResearchFieldDetail}
    isLoading={isLoadingDetail}
>
    {#if selectedResearchField}
        <ResearchFieldDetail
            bind:researchField={selectedResearchField}
            projectLanguages={data.projectLanguages}
            on:save={handleResearchFieldSave}
            on:delete={handleResearchFieldDelete}
        />
    {:else if isLoadingDetail}
        <div class="p-3 text-center">Loading details...</div>
    {:else if selectedResearchFieldId && !selectedResearchField}
        <div class="p-3 text-center text-danger">
            Could not load details for the selected research field.
        </div>
    {/if}
</SidePanel>
