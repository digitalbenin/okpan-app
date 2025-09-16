<script>
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";

    let { items = [], selectedInstitutions = $bindable([]) } = $props();
</script>

<div class="filter-group mb-3">
    <label class="filter-label fw-semibold mb-2 d-block">Institution</label>
    <div class="institution-selection d-flex flex-column gap-2">
        <BaseSelect
            items={items}
            bind:value={selectedInstitutions}
            placeholder="Select institutions..."
            type="multiple"
            size="sm"
        />
        {#if selectedInstitutions.length > 0}
            <div class="selected-institutions d-flex flex-wrap gap-1 mt-1">
                {#each selectedInstitutions as instId}
                    {@const institution = items.find((i) => i.value === instId)}
                    {#if institution}
                        <span class="institution-tag d-inline-flex align-items-center gap-1 px-2 py-1 bg-light text-dark border border-dark rounded-pill">
                            {institution.label}
                            <button
                                class="remove-tag bg-transparent border-0 text-dark cursor-pointer fs-6"
                                onclick={() =>
                                    (selectedInstitutions = selectedInstitutions.filter((id) => id !== instId))}
                            >
                                ×
                            </button>
                        </span>
                    {/if}
                {/each}
            </div>
        {/if}
    </div>
</div>