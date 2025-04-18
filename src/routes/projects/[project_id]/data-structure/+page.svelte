<script>
    import BaseInput from "$lib/components/base/BaseInput.svelte"; // Keep for structure

    let { data } = $props(); // Access data loaded from +page.js
    // $inspect(data); // Keep inspect if helpful for debugging

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
                <BaseInput type="search" placeholder="Search..." disabled />
            </div>
        </header>
        <div class="d-flex flex-wrap gap-2">
            {#each data.researchFields || [] as field (field.id)}
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
                    No research fields found for this project.
                </p>
            {/each}
        </div>
    </section>

    <hr class="my-4" />

    <section class="mb-4">
        <header class="d-flex justify-content-between align-items-center mb-3">
            <h2 class="h2 mb-0">Default fields</h2>
            <div class="col-3">
                <BaseInput type="search" placeholder="Search..." disabled />
            </div>
        </header>
        {#each Object.entries(groupedOntologyFields) as [category, fields] (category)}
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
                                >{field.name?.content || "Unnamed Field"}</span
                            >
                            <div class="d-flex gap-1">
                                <button
                                    class="btn btn-link p-1 text-secondary lh-1"
                                    title={field.description?.content ||
                                        "No description"}
                                    onclick={() => showInfo(field)}>ⓘ</button
                                >
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {:else}
            <p class="text-muted">No default fields found.</p>
        {/each}
    </section>
</div>
