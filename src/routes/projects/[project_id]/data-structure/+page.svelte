<script>
    import BaseInput from "$lib/components/base/BaseInput.svelte"; // Keep for structure

    let { data } = $props(); // Access data loaded from +page.js
    // $inspect(data); // Keep inspect if helpful for debugging
    $effect(() => {
        console.log("[+page.svelte] Data prop updated:", structuredClone(data));
        console.log("[+page.svelte] Research Fields:", data?.researchFields);
        console.log("[+page.svelte] Ontology Fields:", data?.ontologyFields);
    });

    // --- State for Search ---
    let researchSearchTerm = $state("");
    let ontologySearchTerm = $state("");

    // --- Filtered Research Fields (Derived State) ---
    const filteredResearchFields = $derived.by(() => {
        const searchTerm = researchSearchTerm.toLowerCase();
        if (!searchTerm) return data.researchFields || []; // Return all if search is empty
        return (data.researchFields || []).filter((field) =>
            field.name?.content?.toLowerCase().includes(searchTerm),
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

    // TODO: Implement actual edit/info actions
    function editField(fieldId) {
        console.log("Edit field:", fieldId);
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
