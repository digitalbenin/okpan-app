<script>
    import { invalidate } from "$app/navigation"; // No longer needed
    import { setContext } from "svelte"; // Keep removed
    import BaseInput from "$lib/components/base/BaseInput.svelte"; // Keep for structure
    import SidePanel from "$lib/components/common/SidePanel.svelte"; // Added
    import ResearchFieldDetail from "$lib/components/research_fields/ResearchFieldDetail.svelte"; // Added
    // TODO: Import utility functions for updating/fetching research fields (e.g., from ResearchFieldsUtils.js)
    // import { updateResearchField, getResearchField } from "$lib/stores/ResearchFieldsUtils.js";
    // --- Added Imports ---
    import {
        updateResearchField,
        getResearchFieldById,
        deleteResearchField,
    } from "$lib/stores/ResearchFieldsUtils.js";
    // --- End Added Imports ---

    let { data } = $props(); // Access data loaded from +page.js
    // $inspect(data); // Keep inspect if helpful for debugging

    // --- Local Reactive State for Research Fields ---
    let localResearchFields = $state(data.researchFields || []);
    // Keep local state in sync if the prop changes (e.g., initial load or HMR)
    $effect(() => {
        localResearchFields = data.researchFields || [];
    });
    // --- End Local State ---

    // --- Provide project languages via context --- Removed again, using props ---
    // setContext("projectLanguages", data.projectLanguages || []);
    // --- End Removed Section ---

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
    let closeContentTimeout = $state(null); // Reuse timeout logic pattern

    // --- Uses local state now ---
    function findResearchFieldById(id) {
        return (
            localResearchFields?.find((rf) => String(rf.id) === String(id)) || // Use local state
            null
        );
    }

    function showResearchFieldDetail(fieldId) {
        if (closeContentTimeout) {
            clearTimeout(closeContentTimeout);
            closeContentTimeout = null;
        }
        const field = findResearchFieldById(fieldId); // Now uses local state
        const newFieldId = field ? String(field.id) : null;

        if (newFieldId && newFieldId !== selectedResearchFieldId) {
            console.log(`Showing research field detail for ${newFieldId}`);
            selectedResearchFieldId = newFieldId;
            selectedResearchField = field;
        } else if (!newFieldId) {
            console.warn(`Research field ${fieldId} not found.`);
            closeResearchFieldDetail(); // Close if not found
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
                } else {
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
                }
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
                console.log("Research field deleted successfully.");
                // --- Update local reactive state ---
                localResearchFields = localResearchFields.filter(
                    (rf) => rf.id !== id,
                );
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
        console.log("Show info for field:", field);
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
                        <button
                            class="btn btn-link p-1 text-secondary lh-1"
                            title={field.description?.content ||
                                "No description"}
                            onclick={() => showInfo(field)}>ⓘ</button
                        >
                        <button
                            class="btn btn-link p-1 text-secondary lh-1"
                            title="Edit field"
                            onclick={() => editField(field.id)}>✎</button
                        >
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
                                    <button
                                        class="btn btn-link p-1 text-secondary lh-1"
                                        title={field.description?.content ||
                                            "No description"}
                                        onclick={() => showInfo(field)}
                                        >ⓘ</button
                                    >
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
    isOpen={!!selectedResearchFieldId}
    on:close={closeResearchFieldDetail}
    position="right"
    width="500px"
    aria-labelledby="researchFieldDetailTitle"
>
    <div
        slot="header"
        class="d-flex align-items-center justify-content-between"
    >
        <div class="d-flex align-items-center gap-2">
            <button
                type="button"
                onclick={closeResearchFieldDetail}
                class="btn btn-light border-1 px-2 me-2 rounded-0 border-dark text-decoration-none text-dark"
                aria-label="Close research field detail"
            >
                <i class="bi bi-chevron-right"></i>
                <!-- Or appropriate icon -->
            </button>
            <h5 id="researchFieldDetailTitle" class="mb-0 text-break">
                {selectedResearchField?.name?.content ||
                    "Research Field Detail"}
            </h5>
        </div>
    </div>
    {#if selectedResearchField}
        <ResearchFieldDetail
            researchField={selectedResearchField}
            projectLanguages={data.projectLanguages}
            on:save={handleResearchFieldSave}
            on:delete={handleResearchFieldDelete}
        />
    {:else}
        <p class="p-3">Loading...</p>
    {/if}
</SidePanel>
