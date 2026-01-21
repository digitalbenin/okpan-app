<script>
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";

    let {
        freeTextFieldOptions = [],
        freeTextFilters = $bindable([]),
        onChange = null,
    } = $props();

    function addFreeTextFilter() {
        freeTextFilters = [
            ...freeTextFilters,
            {
                fieldId:
                    freeTextFieldOptions.length > 0
                        ? freeTextFieldOptions[0]?.value
                        : "",
                query: "",
            },
        ];
        notify();
    }

    function removeFreeTextFilter(index) {
        freeTextFilters = freeTextFilters.filter(
            (_, i) => i !== index,
        );
        notify();
    }

    function notify() {
        if (typeof onChange === "function") {
            try {
                onChange(freeTextFilters);
            } catch (e) {
                console.error("Error in onFreeTextFiltersChanged:", e);
            }
        }
    }
</script>

<div class="filter-group mb-4">
    <p class="filter-label fw-semibold mb-1 d-block">Research fields (free text)</p>
    {#each freeTextFilters as filter, index}
        <div
            class="free-text-filter bg-white border border-light-subtle rounded-3 p-3 d-flex flex-column gap-2 mb-2"
        >
            <div class="field-row d-flex align-items-center gap-2">
                <BaseSelect
                    items={freeTextFieldOptions}
                    bind:value={filter.fieldId}
                    placeholder="Select research field..."
                    type="single"
                    size="sm"
                    onValueChange={notify}
                />
                <span class="arrow text-body-tertiary">→</span>
                <input
                    type="text"
                    class="value-input flex-grow-1 px-2 py-1 border rounded-2"
                    bind:value={filter.query}
                    placeholder="Enter search terms..."
                    oninput={notify}
                />
                <button
                    class="remove-filter bg-transparent border-0 text-danger cursor-pointer fs-5"
                    onclick={() => removeFreeTextFilter(index)}
                >
                    ×
                </button>
            </div>
        </div>
    {/each}
    <button
        class="add-filter mt-2 border btn btn-sm btn-light border-secondary-subtle rounded-2 px-3 py-1 cursor-pointer"
        onclick={addFreeTextFilter}
    >
        <i class="bi bi-plus-circle"></i>
        Add field
    </button>
</div>
