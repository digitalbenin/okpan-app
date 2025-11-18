<script>
    import BaseToggle from "$lib/components/base/BaseToggle.svelte";

    // onUpdatePrimary: (detail: { id: string, primary: boolean }) => void
    // onUpdateDefaultDescription: (detail: { id: string, default_description: boolean }) => void
    let {
        mappings = [],
        onUpdatePrimary = (detail) => {
            console.warn("onUpdatePrimary prop not provided", detail);
        },
        onUpdateDefaultDescription = (detail) => {
            console.warn(
                "onUpdateDefaultDescription prop not provided",
                detail,
            );
        },
    } = $props();


    let expandedPreviews = $state({});

    function handlePrimaryToggle(mappingId, newPrimaryState) {
        onUpdatePrimary({
            id: mappingId,
            primary: newPrimaryState,
        });
    }

    function handleDefaultDescriptionToggle(
        mappingId,
        newDefaultDescriptionState,
    ) {
        onUpdateDefaultDescription({
            id: mappingId,
            default_description: newDefaultDescriptionState,
        });
    }

    function togglePreviewExpansion(mappingId) {
        expandedPreviews[mappingId] = !expandedPreviews[mappingId];
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
                        <th
                            scope="col"
                            class="text-center fw-semibold"
                            style="width: 15%;">Default Description</th
                        >
                    </tr>
                </thead>
                <tbody>
                    {#each mappings as mapping (mapping.id)}
                        {@const isExpanded = !!expandedPreviews[mapping.id]}
                        <tr>
                            <td>{mapping.institutionField || "-"}</td>
                            <td>
                                {#if mapping.previewValues && mapping.previewValues.length > 0}
                                    <div class="d-flex align-items-start">
                                        <div class="flex-grow-1">
                                            {#if isExpanded}
                                                <!-- Expanded View -->
                                                <ul class="list-unstyled mb-0">
                                                    {#each mapping.previewValues.slice(0, 5) as pv, i}
                                                        <li
                                                            title={pv}
                                                            class="mb-1"
                                                            style="word-break: break-all; white-space: normal;"
                                                        >
                                                            {pv}
                                                        </li>
                                                    {/each}
                                                    {#if mapping.previewValues.length > 5}
                                                        <li
                                                            class="text-muted mb-1"
                                                        >
                                                            ...and {mapping
                                                                .previewValues
                                                                .length - 5} more
                                                        </li>
                                                    {/if}
                                                </ul>
                                            {:else}
                                                <!-- Collapsed View -->
                                                <span
                                                    class="d-inline-block text-truncate"
                                                    style="max-width: 180px;"
                                                    title={mapping
                                                        .previewValues[0]}
                                                >
                                                    {mapping.previewValues[0]}
                                                </span>
                                            {/if}
                                        </div>
                                        {#if mapping.previewValues.length > 0}
                                            <!-- Show button only if there are values to potentially expand -->
                                            <button
                                                type="button"
                                                class="btn btn-link btn-sm p-0 ms-2 flex-shrink-0"
                                                onclick={() =>
                                                    togglePreviewExpansion(
                                                        mapping.id,
                                                    )}
                                                aria-label={isExpanded
                                                    ? "Collapse previews"
                                                    : "Expand previews"}
                                                title={isExpanded
                                                    ? "Collapse"
                                                    : "Expand"}
                                            >
                                                <i
                                                    class="bi text-dark {isExpanded
                                                        ? 'bi-chevron-up'
                                                        : 'bi-chevron-down'}"
                                                ></i>
                                            </button>
                                        {/if}
                                    </div>
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
                            <td class="text-center">
                                <BaseToggle
                                    value={!!mapping.default_description}
                                    onChange={(event) =>
                                        handleDefaultDescriptionToggle(
                                            mapping.id,
                                            event.target.checked,
                                        )}
                                    label={null}
                                    id={`default-description-toggle-${mapping.id}`}
                                />
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>
