<script>
    import BaseToggle from "$lib/components/base/BaseToggle.svelte";
    import { createEventDispatcher } from "svelte";

    // Props
    // Expected structure for each item in 'mappings':
    // {
    //   id: string, // Unique ID for this mapping instance (e.g., a composite key or specific record ID)
    //   institutionField: string, // The label from the source data (objects_ontology_fields.label)
    //   previewValues: string[], // Array of up to 5 sample values (objects_ontology_fields.value)
    //   ontologyFieldName: string, // Name of the linked ontology term (ontology_fields.name.content)
    //   isPrimary: boolean // Whether this mapping is primary (objects_ontology_fields.primary)
    // }
    let { mappings = [] } = $props();

    const dispatch = createEventDispatcher();

    function handlePrimaryToggle(mappingId, newPrimaryState) {
        dispatch("updateMappingPrimary", {
            id: mappingId,
            primary: newPrimaryState,
        });
    }
</script>

<div class="datasource-mapping-container p-3">
    {#if !mappings || mappings.length === 0}
        <p class="text-muted fst-italic mt-3">
            No field mappings found for this data source, or the data is still
            loading.
        </p>
    {:else}
        <div class="table-responsive">
            <table
                class="table table-sm table-bordered table-hover align-middle"
            >
                <thead class="table-light">
                    <tr>
                        <th scope="col" style="width: 25%;" class="fw-semibold"
                            >Institution Field</th
                        >
                        <th scope="col" style="width: 35%;" class="fw-semibold"
                            >Preview Values</th
                        >
                        <th scope="col" style="width: 25%;" class="fw-semibold"
                            >Ontology Field</th
                        >
                        <th
                            scope="col"
                            class="text-center fw-semibold"
                            style="width: 15%;">Primary</th
                        >
                    </tr>
                </thead>
                <tbody>
                    {#each mappings as mapping (mapping.id)}
                        <tr>
                            <td>{mapping.institutionField || "-"}</td>
                            <td>
                                {#if mapping.previewValues && mapping.previewValues.length > 0}
                                    <ul class="list-unstyled mb-0 small">
                                        {#each mapping.previewValues.slice(0, 5) as pv}
                                            <li
                                                title={pv}
                                                class="text-truncate mb-1"
                                                style="max-width: 220px;"
                                            >
                                                {pv}
                                            </li>
                                        {/each}
                                        {#if mapping.previewValues.length > 5}
                                            <li class="text-muted mb-1">
                                                ...and {mapping.previewValues
                                                    .length - 5} more
                                            </li>
                                        {/if}
                                    </ul>
                                {:else}
                                    <span class="text-muted small fst-italic"
                                        >No previews available</span
                                    >
                                {/if}
                            </td>
                            <td>
                                <span class="badge bg-secondary mx-2"
                                    >{mapping.ontologyFieldName || "-"}</span
                                >
                            </td>
                            <td class="text-center">
                                <BaseToggle
                                    value={!!mapping.isPrimary}
                                    onChange={(event) =>
                                        handlePrimaryToggle(
                                            mapping.id,
                                            event.target.checked,
                                        )}
                                    label={null}
                                    id={`primary-toggle-${mapping.id}`}
                                />
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>
