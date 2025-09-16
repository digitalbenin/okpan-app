<script>
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";

    let { researchFieldOptions = [], researchFieldFilters = $bindable([]) } =
        $props();

    function addResearchFieldFilter() {
        researchFieldFilters = [
            ...researchFieldFilters,
            {
                fieldId:
                    researchFieldOptions.length > 0
                        ? researchFieldOptions[0]?.value
                        : "",
                query: "",
                vocabularyIds: [],
            },
        ];
    }

    function removeResearchFieldFilter(index) {
        researchFieldFilters = researchFieldFilters.filter(
            (_, i) => i !== index,
        );
    }
</script>

<div class="filter-group">
    <p class="filter-label fw-semibold mb-2 d-block">Research field</p>
    {#each researchFieldFilters as filter, index}
        {@const selectedField = researchFieldOptions.find(
            (o) => o.value === filter.fieldId,
        )}
        <div
            class="research-field-filter bg-white border border-light-subtle rounded-3 p-3 d-flex flex-column gap-2 mb-2"
        >
            <div class="field-row d-flex align-items-center gap-2">
                <BaseSelect
                    items={researchFieldOptions}
                    bind:value={filter.fieldId}
                    placeholder="Select research field..."
                    type="single"
                    size="sm"
                />
                <span class="arrow text-body-tertiary">→</span>
                {#if selectedField && selectedField.vocabOptions && selectedField.vocabOptions.length > 0}
                    <BaseSelect
                        class="flex-grow-1"
                        items={selectedField.vocabOptions}
                        bind:value={filter.vocabularyIds}
                        placeholder="Select vocabulary options..."
                        type="multiple"
                        size="sm"
                    />
                {:else}
                    <input
                        type="text"
                        class="value-input flex-grow-1 px-2 py-1 border rounded-2"
                        bind:value={filter.query}
                        placeholder="Enter search terms..."
                    />
                {/if}
                <button
                    class="remove-filter bg-transparent border-0 text-danger cursor-pointer fs-5"
                    onclick={() => removeResearchFieldFilter(index)}
                >
                    ×
                </button>
            </div>
        </div>
    {/each}
    <button
        class="add-filter mt-2 border border-dark bg-transparent text-dark rounded-2 px-3 py-1 cursor-pointer"
        onclick={addResearchFieldFilter}
    >
        <i class="bi bi-plus-circle"></i>
        Add field
    </button>
</div>
