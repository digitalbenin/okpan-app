<script>
    import { page } from "$app/stores";

    import { searchObjects } from "$lib/stores/ObjectsUtils.js";
    import { onMount } from "svelte";
    import PreviewTable from "$lib/components/export/PreviewTable.svelte";
    import StatusFilter from "$lib/components/export/StatusFilter.svelte";
    import InstitutionFilter from "$lib/components/export/InstitutionFilter.svelte";
    import ResearchFieldFilters from "$lib/components/export/ResearchFieldFilters.svelte";

    let { data } = $props();

    let projectId = $derived($page.params.project_id);

    // Export format selection
    let selectedFormat = $state("csv");
    let includeAssets = $state(false);

    // Filter states
    let selectedStatus = $state("all");
    let selectedInstitutions = $state([]);
    let researchFieldFilters = $state([]);

    // Pagination and data states
    let currentPage = $state(1);
    let pageSize = $state(10);
    let objects = $state([]);
    let totalCount = $state(0);
    let isLoading = $state(false);
    // Global set: IDs explicitly deselected by user (persists across pages)
    let deselectedObjectIds = $state(new Set());
    // NEW: facets from search response for dynamic counts
    let facets = $state({ institutions: [], statuses: [], researchFields: [] });

    // Available options
    let exportFormats = [
        { value: "csv", label: "CSV" },
        { value: "json", label: "JSON" },
        { value: "sql", label: "SQLite" },
    ];

    // Search function
    async function performSearch() {
        isLoading = true;
        try {
            const searchParams = buildSearchParams();

            console.log(
                "Searching with params:",
                JSON.parse(JSON.stringify(searchParams)),
            );
            const response = await searchObjects(searchParams);

            if (response.error) {
                console.error("Search error:", response.error);
                objects = [];
                totalCount = 0;
                facets = { institutions: [], statuses: [], researchFields: [] };
                // Selection derived from deselectedObjectIds; nothing to reset here
            } else {
                objects = response.items || [];
                totalCount = response.totalCount || 0;
                facets = response.facets || {
                    institutions: [],
                    statuses: [],
                    researchFields: [],
                };
                // Selection on this page is derived from deselectedObjectIds
            }
        } catch (error) {
            console.error("Error searching objects:", error);
            objects = [];
            totalCount = 0;
            facets = { institutions: [], statuses: [], researchFields: [] };
            // Selection derived from deselectedObjectIds
        } finally {
            isLoading = false;
        }
    }

    // Trigger initial no-filter search on mount
    onMount(() => {
        console.log("Initial search on mount");
        performSearch();
    });

    function handlePageChange(newPage) {
        currentPage = newPage ?? currentPage;
        console.log("Page changed via callback to", currentPage);
        performSearch();
    }

    // Get research fields from page data
    let researchFields = $derived.by(() => {
        const rf = data.researchFields;
        if (Array.isArray(rf)) return rf; // Already an array
        if (rf && Array.isArray(rf.result)) return rf.result; // Response wrapper with .result
        if (rf && Array.isArray(rf.research_fields)) return rf.research_fields; // Alt shape
        return [];
    });

    // Convert research fields to select options
    let researchFieldOptions = $derived.by(() => {
        const list = Array.isArray(researchFields) ? researchFields : [];
        return list.map((field) => {
            const name = field?.name;
            const label =
                typeof name === "string"
                    ? name
                    : (name?.content ??
                      (Array.isArray(name?.translations) &&
                          name.translations[0]?.content) ??
                      String(field.id));
            return {
                value: field.id,
                label,
                group: field?.project?.title?.content ?? "Research Fields",
                vocabOptions: Array.isArray(field?.vocabularies)
                    ? field.vocabularies.map((v) => ({
                          value: v.id,
                          label: v?.option?.content ?? v.id,
                      }))
                    : [],
            };
        });
    });

    // Helpers to keep IPC/search payloads serializable and DRY
    function sanitizeResearchFieldFilters(filters) {
        if (!Array.isArray(filters) || filters.length === 0) return [];
        return filters.map((filter) => {
            const allowed = (
                researchFieldOptions.find((o) => o.value === filter.fieldId)
                    ?.vocabOptions || []
            ).map((v) => v.value);
            const vocab = (
                Array.isArray(filter.vocabularyIds) ? filter.vocabularyIds : []
            ).filter((id) => allowed.includes(id));
            return {
                fieldId: filter.fieldId,
                query: filter.query || "",
                vocabularyIds: vocab,
            };
        });
    }

    function buildCommonFilters() {
        return {
            project_id: projectId,
            ...(selectedStatus !== "all" && { status: selectedStatus }),
            ...(selectedInstitutions.length > 0 && {
                institutionIds: [...selectedInstitutions],
            }),
            ...(researchFieldFilters.length > 0 && {
                researchFieldFilters:
                    sanitizeResearchFieldFilters(researchFieldFilters),
            }),
        };
    }

    function buildSearchParams() {
        return {
            projectId,
            page: currentPage - 1, // Convert to 0-based for backend
            pageSize,
            ...(selectedStatus !== "all" && { status: selectedStatus }),
            ...(selectedInstitutions.length > 0 && {
                institutionIds: [...selectedInstitutions],
            }),
            ...(researchFieldFilters.length > 0 && {
                researchFieldFilters:
                    sanitizeResearchFieldFilters(researchFieldFilters),
            }),
        };
    }

    // Handle export
    async function handleExport() {
        try {
            if (!window?.api?.exportProject) {
                console.error("window.api.exportProject is not available");
                return;
            }

            // Use globally tracked deselections across all pages
            const excludeIds = Array.from(deselectedObjectIds);

            const exportOptions = {
                filters: {
                    ...buildCommonFilters(),
                    ...(excludeIds.length > 0 && {
                        excludeObjectIds: excludeIds,
                    }),
                },
                includeAssets: !!includeAssets,
                format: selectedFormat,
            };

            console.log(
                "Exporting with options:",
                JSON.parse(JSON.stringify(exportOptions)),
                "excludeObjectIds:",
                excludeIds.length,
            );

            const result = await window.api.exportProject(exportOptions);

            if (result.canceled) return;

            console.log("Export completed:", result);
        } catch (error) {
            console.error("Export failed:", error);
        }
    }

    // Computed values
    let exportSummary = $derived(`Objects matching filters: ${totalCount}`);
    // Dynamic status counts from facets
    let completedCount = $derived(
        facets?.statuses?.find((s) => (s.id ?? s.name) === "completed")
            ?.count || 0,
    );
    let inProgressCount = $derived(
        facets?.statuses?.find((s) => (s.id ?? s.name) === "in progress")
            ?.count || 0,
    );
</script>

<div class="export-page container-fluid py-4">
    <div class="col-lg-8">
        <!-- Header -->
        <div class="header mb-4">
            <h2 class="h2 mb-1">Export</h2>
            <p class="text-muted">Choose the filters to export your dataset.</p>
        </div>

        <!-- Export Format Selection -->
        <div class="export-format-section mb-4">
            <h5 class="h5 mb-2">Export as</h5>
            <div class="format-options d-flex gap-3">
                {#each exportFormats as format}
                    <label
                        class="format-option d-inline-flex align-items-center gap-2 px-3 py-2 border rounded-2 cursor-pointer {selectedFormat ===
                        format.value
                            ? 'border border-primary'
                            : ''}"
                    >
                        <input
                            type="radio"
                            bind:group={selectedFormat}
                            value={format.value}
                        />
                        <span class="format-label">{format.label}</span>
                        {#if format.value === "csv"}
                            <span
                                class="bi bi-table d-inline-flex align-items-center justify-content-center rounded-2 {selectedFormat ===
                                format.value
                                    ? 'bg-primary text-white'
                                    : 'bg-light text-secondary'}"
                                style="width: 2rem; height: 2rem;"
                            ></span>
                        {:else if format.value === "json"}
                            <span
                                class="bi bi-braces d-inline-flex align-items-center justify-content-center rounded-2 {selectedFormat ===
                                format.value
                                    ? 'bg-primary text-white'
                                    : 'bg-light text-secondary'}"
                                style="width: 2rem; height: 2rem;"
                            ></span>
                        {:else if format.value === "sql"}
                            <span
                                class="bi bi-database d-inline-flex align-items-center justify-content-center rounded-2 {selectedFormat ===
                                format.value
                                    ? 'bg-primary text-white'
                                    : 'bg-light text-secondary'}"
                                style="width: 2rem; height: 2rem;"
                            ></span>
                        {/if}
                    </label>
                {/each}
            </div>
        </div>

        <!-- Assets Section -->
        <div class="assets-section mb-4">
            <label class="asset-option d-flex align-items-center gap-2">
                <input type="checkbox" bind:checked={includeAssets} />
                <span>Include assets in the export</span>
            </label>
        </div>

        <!-- Filter Content Section -->
        <div class="filter-section mb-4">
            <h5 class="h5 mb-3">Filter content</h5>

            <!-- Status Filter -->
            <StatusFilter
                bind:selectedStatus
                {completedCount}
                {inProgressCount}
            />

            <!-- Institution Filter -->
            <InstitutionFilter
                items={data.institutions}
                bind:selectedInstitutions
            />

            <!-- Research Field Filters -->
            <ResearchFieldFilters
                {researchFieldOptions}
                bind:researchFieldFilters
            />
        </div>

        <!-- Results Section -->
        <div class="results-section mt-4">
            <div
                class="summary d-flex align-items-center justify-content-between mb-3"
            >
                <div class="summary-left">
                    <div class="summary-text text-body">{exportSummary}</div>
                </div>
                <div class="summary-right"></div>
            </div>

            <PreviewTable
                {objects}
                bind:deselectedObjectIds
                bind:page={currentPage}
                {pageSize}
                count={totalCount}
                onPageChange={handlePageChange}
            />
        </div>
    </div>
</div>

<!-- Sticky bottom action bar -->
<div
    class="sticky-bottom-bar position-sticky bottom-0 bg-white border-top border-light-subtle mt-auto z-1 flex-shrink-0"
>
    <div class="container-fluid">
        <div class="row">
            <div class="col-12 d-flex justify-content-end gap-2 p-2">
                <button
                    type="button"
                    class="btn btn-sm btn-success"
                    onclick={handleExport}
                    disabled={totalCount === 0 ||
                        totalCount - deselectedObjectIds.size === 0}
                    title={totalCount === 0
                        ? "No objects match current filters"
                        : totalCount - deselectedObjectIds.size === 0
                          ? "No objects selected"
                          : ""}
                >
                    Export
                </button>
            </div>
        </div>
    </div>
</div>
