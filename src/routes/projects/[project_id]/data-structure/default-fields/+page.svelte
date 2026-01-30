<script>
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseButton from "$lib/components/base/BaseButton.svelte";
    import BaseCheckBox from "$lib/components/base/BaseCheckBox.svelte";
    import BaseBadge from "$lib/components/base/BaseBadge.svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { updateOntologyField } from "$lib/stores/OntologyFieldsUtils.js";

    const { data } = $props();
    const { t } = getTranslationStore();

    let search = $state("");

    // Filter ontology fields based on search input
    const filteredOntologyFields = $derived.by(() => {
        if (!search || !search.trim()) {
            return data.ontologyFields || [];
        }

        const searchTerm = search.toLowerCase().trim();
        return (data.ontologyFields || []).filter(
            (field) =>
                field.name?.content?.toLowerCase().includes(searchTerm) ||
                field.description?.content
                    ?.toLowerCase()
                    .includes(searchTerm) ||
                field.category?.content?.toLowerCase().includes(searchTerm),
        );
    });

    // Group fields dynamically by their categories
    const fieldsByCategory = $derived.by(() => {
        const groups = {};
        filteredOntologyFields.forEach((field) => {
            const categoryName = field.category?.content || "Uncategorized";
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push(field);
        });
        return groups;
    });

    // Get sorted category names for consistent ordering
    const categoryNames = $derived.by(() => {
        return Object.keys(fieldsByCategory).sort();
    });

    // Function to get "More info" text - placeholder for now
    function getMoreInfo(field) {
        return "More info";
    }

    // Function to handle checkbox changes for onwebsite field
    async function handleOnwebsiteChange(field, newValue) {
        try {
            const updateData = {
                onwebsite: newValue ? 1 : 0,
            };

            const result = await updateOntologyField(field.id, updateData);

            if (result.error) {
                console.error("Error updating onwebsite:", result.error);
            } else {
                // Update the local data to reflect the change
                field.onwebsite = newValue ? 1 : 0;
            }
        } catch (error) {
            console.error("Error updating onwebsite:", error);
        }
    }
</script>

<div class="container-fluid py-4">
    <div class="row mb-4">
        <div class="col-12">
            <h1 class="h3 mb-0">{t("project.default-fields", { fallback: "Default fields" })}</h1>
        </div>
    </div>

    <div class="row align-items-center mb-4">
        <div class="col-4">
            <BaseInput
                icon="search"
                placeholder={t("common.search", { fallback: "Search" })}
                clearable
                size="sm"
                bind:value={search}
            />
        </div>
    </div>

    <!-- Dynamic Category Sections -->
    {#each categoryNames as categoryName (categoryName)}
        <div class="mb-5">
            <h3 class="mb-3">{categoryName}</h3>

            {#if fieldsByCategory[categoryName].length > 0}
                {#each fieldsByCategory[categoryName] as field (field.id)}
                    <div class="row py-3 border-bottom align-items-start">
                        <div class="col-3">
                            <BaseBadge
                                class="bg-secondary-subtle text-dark"
                                value={field.name?.content || "Unnamed field"}
                            ></BaseBadge>
                        </div>
                        <div class="col-6">
                            <p class="mb-0 text-muted">
                                {field.description?.content ||
                                    "No description available"}
                            </p>
                        </div>
                        <div class="col-3 text-end">
                            <div
                                class="d-flex flex-column align-items-start gap-2"
                            >
                               
                                <BaseCheckBox
                                    labelText={t("common.public-website", {
                                        fallback: "Publish on website",
                                    })}
                                    checked={field.onwebsite === 1}
                                    onclick={() =>
                                        handleOnwebsiteChange(
                                            field,
                                            field.onwebsite !== 1,
                                        )}
                                />
                            </div>
                        </div>
                    </div>
                {/each}
            {:else}
                <div class="text-center fst-italic text-muted py-4">
                    {#if search && search.trim()}
                        {t("common.no-search-results", {
                            fallback: `No ${categoryName.toLowerCase()} fields match your search.`,
                        })}
                    {:else}
                        {t("common.no-fields-available", {
                            fallback: `No ${categoryName.toLowerCase()} fields available.`,
                        })}
                    {/if}
                </div>
            {/if}
        </div>
    {/each}

    {#if search && search.trim() && filteredOntologyFields.length === 0}
        <div class="text-center fst-italic text-muted mt-5">
            {t("common.no-search-results", {
                fallback: "No fields match your search.",
            })}
            <div class="mt-2">
                <button
                    class="btn btn-link btn-sm p-0"
                    onclick={() => (search = "")}
                >
                    {t("common.clear-search", { fallback: "Clear search" })}
                </button>
            </div>
        </div>
    {/if}
</div>
