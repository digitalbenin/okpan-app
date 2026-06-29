<script>
    import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
    import { IconTableOptions, IconInfoCircle } from "@tabler/icons-svelte";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import { updateOntologyField } from "$lib/api/OntologyFieldsApi.js";

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
            const categoryName = field.category?.content || t("common.uncategorized");
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

<!-- Heading section -->
<div class="bg-white border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4">
	<div class="d-flex flex-column gap-3">
		<div class="d-flex align-items-center gap-3">
			<div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
				<IconTableOptions size={32} />
			</div>
			<h1 class="mb-0 flex-grow-1">{t("menu.mapping-fields", { fallback: "Mapping fields" })}</h1>
		</div>
		<p class="mb-0" style="font-size: 14px;">{t("default-fields.page-description", { fallback: "Here you can see the list of fields you can use to map the data you receive from institutions and decide to make them public or not." })}</p>
	</div>
</div>

<div class="container-fluid py-4">
    <div class="row g-3">
        <div class="col-12 col-lg-8 col-xl-9 min-w-0">
            <div class="bg-white rounded-3 p-4">
                <!-- Search -->
                <BaseSearchBar bind:search border="border-secondary-subtle" placeholder={t("filters.search", { fallback: "Search" })} />

                <!-- Dynamic Category Sections -->
                {#each categoryNames as categoryName (categoryName)}
                    <div class="mb-5">
                        <h3 class="mb-3">{categoryName}</h3>

                        {#if fieldsByCategory[categoryName].length > 0}
                            <!-- Table header -->
                            <div class="d-flex gap-3 align-items-center pb-2 text-body-secondary fw-semibold" style="font-size: 14px;">
                                <p class="mb-0" style="flex: 6; min-width: 0;">{t("research-fields.field-name", { fallback: "Field name" })}</p>
                                <p class="mb-0" style="flex: 9; min-width: 0;">{t("research-fields.description", { fallback: "Description" })}</p>
                                <p class="mb-0" style="flex: 3; min-width: 0;">{t("research-fields.visibility", { fallback: "Visibility on website" })}</p>
                            </div>

                            {#each fieldsByCategory[categoryName] as field (field.id)}
                                <div class="d-flex gap-3 align-items-start py-3 border-top">
                                    <p class="mb-0 fw-semibold text-body" style="flex: 6; min-width: 0; font-size: 14px; word-break: break-word;">{field.name?.content || t("common.unnamed-field")}</p>
                                    <p class="mb-0 text-body-secondary" style="flex: 9; min-width: 0; font-size: 14px; word-break: break-word;">{field.description?.content || t("common.no-description-available")}</p>
                                    <div class="d-flex align-items-center" style="flex: 3; min-width: 0;">
                                        <div class="form-check">
                                            <input
                                                type="checkbox"
                                                class="form-check-input"
                                                id={`onwebsite-${field.id}`}
                                                checked={field.onwebsite === 1}
                                                onchange={() =>
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
                            <div class="text-center fst-italic text-body-secondary py-4">
                                {#if search && search.trim()}
                                    {t("common.no-search-results", { fallback: "No results found" })}
                                {:else}
                                    {t("common.no-fields-available", { fallback: "No fields available" })}
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}

                {#if search && search.trim() && filteredOntologyFields.length === 0}
                    <div class="text-center fst-italic text-body-secondary mt-5">
                        {t("common.no-search-results", { fallback: "No results found" })}
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
        </div>

        <!-- Sidebar -->
        <div class="col-12 col-lg-4 col-xl-3">
            <div class="bg-white border rounded-3 p-4 d-flex flex-column">
                <div class="d-flex flex-column gap-1">
                    <div class="flex-shrink-0">
                        <IconInfoCircle size={16} stroke={2} />
                    </div>
                    <div>
                        <p class="fw-semibold mb-1 text-body">{t("default-fields.help-title", { fallback: "Mapping fields?" })}</p>
                        <div class="text-body-secondary fs-7">
                            <p class="mb-3">{t("default-fields.help-desc-p1", { fallback: "Mapping fields is the step where you tell Okpan which field in your imported file corresponds to which field in your project, so the data lands in the right place and can be searched across institutions." })}</p>
                        </div>
                    </div>
                </div>
                <p class="mb-2 text-body-secondary text-uppercase" style="font-size: 12px; letter-spacing: 0.24px;">{t("default-fields.example-label", { fallback: "Example" })}</p>
                <div class="bg-gray-200 rounded-3 p-3">
                    <p class="mb-0 text-body-secondary" style="font-size: 14px;">{t("default-fields.help-example", { fallback: "Okpan has a \"Display status\" field. One institution exports this as \"On display\", another calls it \"Status\". In the mapping process you connect both to \"Display status\" — from then on, all objects share the same field regardless of how each source labelled it." })}</p>
                </div>
            </div>
        </div>
    </div>
</div>
