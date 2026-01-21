<script>
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";

    let {
        connectionFieldOptions = [],
        connectionFilters = $bindable([]),
        onChange = null,
    } = $props();

    function addConnectionFilter() {
        connectionFilters = [
            ...connectionFilters,
            {
                fieldId:
                    connectionFieldOptions.length > 0
                        ? connectionFieldOptions[0]?.value
                        : "",
                vocabularyIds: [],
            },
        ];
        notify();
    }

    function removeConnectionFilter(index) {
        connectionFilters = connectionFilters.filter(
            (_, i) => i !== index,
        );
        notify();
    }

    function notify() {
        if (typeof onChange === "function") {
            try {
                onChange(connectionFilters);
            } catch (e) {
                console.error("Error in onConnectionFiltersChanged:", e);
            }
        }
    }
</script>

<div class="filter-group mb-4">
    <p class="filter-label fw-semibold mb-2 d-block">Connections</p>
    {#each connectionFilters as filter, index}
        {@const selectedField = connectionFieldOptions.find(
            (o) => o.value === filter.fieldId,
        )}
        <div
            class="connection-filter bg-white border border-light-subtle rounded-3 p-3 d-flex flex-column gap-2 mb-2"
        >
            <div class="field-row d-flex align-items-center gap-2">
                <BaseSelect
                    items={connectionFieldOptions}
                    bind:value={filter.fieldId}
                    placeholder="Select connection..."
                    type="single"
                    size="sm"
                    onValueChange={notify}
                    style="flex-shrink: 0;"
                />
                <span class="arrow text-body-tertiary" style="flex-shrink: 0;">→</span>
                {#if selectedField && selectedField.vocabOptions && selectedField.vocabOptions.length > 0}
                    <div style="max-width: 400px; min-width: 0; flex: 1 1 auto;">
                        <BaseSelect
                            items={selectedField.vocabOptions}
                            bind:value={filter.vocabularyIds}
                            placeholder="Select options..."
                            type="multiple"
                            size="sm"
                            onValueChange={notify}
                        />
                    </div>
                {:else}
                    <span class="text-muted" style="flex: 1 1 auto; min-width: 0;">No options available</span>
                {/if}
                <button
                    class="remove-filter bg-transparent border-0 text-danger cursor-pointer fs-5"
                    style="flex-shrink: 0;"
                    onclick={() => removeConnectionFilter(index)}
                >
                    ×
                </button>
            </div>
        </div>
    {/each}
    <button
        class="btn btn-sm btn-light border-secondary-subtle add-filter mt-1 rounded-2 px-3 py-1 cursor-pointer"
        onclick={addConnectionFilter}
    >
        <i class="bi bi-plus-circle"></i>
        Add connection
    </button>
</div>
