<script>
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    let {
        items = [],
        selectedInstitutions = $bindable([]),
        onChange = null,
    } = $props();

    const { t } = getTranslationStore();

    function handleChange(newValue) {
        if (typeof onChange === "function") {
            try {
                onChange(newValue);
            } catch (e) {
                console.error("Error in onInstitutionsChanged:", e);
            }
        }
    }
</script>

<div class="filter-group mb-4">
    <p class="filter-label fw-semibold mb-2 d-block">
        {t("common.institution", { fallback: "Institution" })}
    </p>
    <div class="institution-selection d-flex flex-column gap-2">
        <BaseSelect
            {items}
            bind:value={selectedInstitutions}
            placeholder={t("export.select-institutions", { fallback: "Select institutions..." })}
            type="multiple"
            size="sm"
            onValueChange={(v) => handleChange(v)}
        />
        {#if selectedInstitutions.length > 0}
            <div class="selected-institutions d-flex flex-wrap gap-1 mt-1">
                {#each selectedInstitutions as instId}
                    {@const institution = items.find((i) => i.value === instId)}
                    {#if institution}
                        <span
                            class="institution-tag d-inline-flex align-items-center gap-1 px-2 py-1 bg-light text-dark border border-dark rounded-pill"
                        >
                            {institution.label}
                            <button
                                class="remove-tag bg-transparent border-0 text-dark cursor-pointer fs-6"
                                aria-label={t("common.remove", { fallback: "Remove" })}
                                onclick={() => {
                                    selectedInstitutions =
                                        selectedInstitutions.filter(
                                            (id) => id !== instId,
                                        );
                                    handleChange(selectedInstitutions);
                                }}
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
