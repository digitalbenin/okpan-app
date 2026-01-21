<script>
    import { page } from "$app/stores";

    import { searchObjects } from "$lib/stores/ObjectsUtils.js";
    import { onMount } from "svelte";
    import PreviewTable from "$lib/components/export/PreviewTable.svelte";
    import StatusFilter from "$lib/components/export/StatusFilter.svelte";
    import InstitutionFilter from "$lib/components/export/InstitutionFilter.svelte";
    import ConnectionFilters from "$lib/components/export/ConnectionFilters.svelte";
    import ResearchFieldFilters from "$lib/components/export/ResearchFieldFilters.svelte";
    import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";

    let { data } = $props();

    let projectId = $derived($page.params.project_id);

    // Export format selection
    let selectedFormat = $state("csv");
    let includeAssets = $state(false);

    // Filter states
    let selectedStatus = $state("all");
    let selectedInstitutions = $state([]);
    let connectionFilters = $state([]);
    let freeTextFilters = $state([]);

    // Pagination and data states
    let currentPage = $state(1);
    let _prevPage = $state(1);
    let pageSize = $state(10);
    let objects = $state([]);
    let totalCount = $state(0);
    let isLoading = $state(false);
    // Global set: IDs explicitly deselected by user (persists across pages)
    let deselectedObjectIds = $state(new Set());
    // NEW: facets from search response for dynamic counts
    let facets = $state({ institutions: [], statuses: [], researchFields: [] });

    // Watch page changes and perform search

    $effect(() => {
        if (currentPage !== _prevPage) {
            _prevPage = currentPage;
            performSearch();
        }
    });

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
            const response = await searchObjects(searchParams);

            if (response.error) {
                objects = [];
                totalCount = 0;
                facets = { institutions: [], statuses: [], researchFields: [] };
            } else {
                objects = response.items || [];
                totalCount = response.totalCount || 0;
                facets = response.facets || {
                    institutions: [],
                    statuses: [],
                    researchFields: [],
                };
            }
        } catch (error) {
            objects = [];
            totalCount = 0;
            facets = { institutions: [], statuses: [], researchFields: [] };
        } finally {
            isLoading = false;
        }
    }

    // Trigger initial no-filter search on mount
    onMount(() => {
        performSearch();
    });

    // Get connection fields (vocabulary type) from page data
    let connectionFields = $derived.by(() => {
        const cf = data.connectionFields;
        if (Array.isArray(cf)) return cf;
        return [];
    });

    // Get free text fields from page data
    let freeTextFields = $derived.by(() => {
        const ftf = data.freeTextFields;
        if (Array.isArray(ftf)) return ftf;
        return [];
    });

    // Convert connection fields to select options
    let connectionFieldOptions = $derived.by(() => {
        return connectionFields.map((field) => {
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
                group: field?.project?.title?.content ?? "Connections",
                vocabOptions: Array.isArray(field?.vocabularies)
                    ? field.vocabularies.map((v) => ({
                          value: v.id,
                          label: v?.option?.content ?? v.id,
                      }))
                    : [],
            };
        });
    });

    // Convert free text fields to select options
    let freeTextFieldOptions = $derived.by(() => {
        return freeTextFields.map((field) => {
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
            };
        });
    });

    // Helpers to keep IPC/search payloads serializable and DRY
    function sanitizeConnectionFilters(filters) {
        if (!Array.isArray(filters) || filters.length === 0) return [];
        return filters.map((filter) => {
            const allowed = (
                connectionFieldOptions.find((o) => o.value === filter.fieldId)
                    ?.vocabOptions || []
            ).map((v) => v.value);
            const vocab = (
                Array.isArray(filter.vocabularyIds) ? filter.vocabularyIds : []
            ).filter((id) => allowed.includes(id));
            return {
                fieldId: filter.fieldId,
                vocabularyIds: vocab,
            };
        });
    }

    function sanitizeFreeTextFilters(filters) {
        if (!Array.isArray(filters) || filters.length === 0) return [];
        return filters
            .filter((filter) => filter.query && filter.query.trim())
            .map((filter) => ({
                fieldId: filter.fieldId,
                query: filter.query.trim(),
            }));
    }

    function buildCommonFilters() {
        const filters = {
            project_id: projectId,
            ...(selectedStatus !== "all" && { status: selectedStatus }),
            ...(selectedInstitutions.length > 0 && {
                institutionIds: [...selectedInstitutions],
            }),
        };

        // Combine connection filters (vocabularies) and free text filters
        const sanitizedConnectionFilters = sanitizeConnectionFilters(connectionFilters);
        const sanitizedFreeTextFilters = sanitizeFreeTextFilters(freeTextFilters);
        
        const allResearchFieldFilters = [
            ...sanitizedConnectionFilters,
            ...sanitizedFreeTextFilters,
        ];

        if (allResearchFieldFilters.length > 0) {
            filters.researchFieldFilters = allResearchFieldFilters;
        }

        return filters;
    }

    function buildSearchParams() {
        const params = {
            projectId,
            page: currentPage - 1, // Convert to 0-based for backend
            pageSize,
            ...(selectedStatus !== "all" && { status: selectedStatus }),
            ...(selectedInstitutions.length > 0 && {
                institutionIds: [...selectedInstitutions],
            }),
        };

        // Combine connection filters (vocabularies) and free text filters
        const sanitizedConnectionFilters = sanitizeConnectionFilters(connectionFilters);
        const sanitizedFreeTextFilters = sanitizeFreeTextFilters(freeTextFilters);
        
        const allResearchFieldFilters = [
            ...sanitizedConnectionFilters,
            ...sanitizedFreeTextFilters,
        ];

        if (allResearchFieldFilters.length > 0) {
            params.researchFieldFilters = allResearchFieldFilters;
        }

        return params;
    }

    function onStatusChanged(newStatus) {
        selectedStatus = newStatus;
        currentPage = 1;
        performSearch();
    }

    function onInstitutionsChanged(newInstitutions) {
        selectedInstitutions = Array.isArray(newInstitutions)
            ? newInstitutions
            : [];
        currentPage = 1;
        performSearch();
    }

    function onConnectionFiltersChanged(newFilters) {
        connectionFilters = Array.isArray(newFilters) ? newFilters : [];
        currentPage = 1;
        performSearch();
    }

    function onFreeTextFiltersChanged(newFilters) {
        freeTextFilters = Array.isArray(newFilters) ? newFilters : [];
        currentPage = 1;
        performSearch();
    }

    // Handle export
    async function handleExport() {
        try {
            if (!window?.api?.exportProject) {
                return;
            }

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

            const result = await window.api.exportProject(exportOptions);

            if (result.canceled) return;
        } catch (error) {
            // intentionally no console output
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

    const exportDisabledReason = $derived.by(() => {
        if (totalCount === 0) {
            return "No objects match current filters";
        }
        if (totalCount - deselectedObjectIds.size <= 0) {
            return "No objects selected";
        }
        return "";
    });

    const rightActionButtons = $derived.by(() => [{
        id: "export-data",
        text: "Export",
        class: "btn btn-success",
        disabled: !!exportDisabledReason,
        onClick: handleExport,
        title: exportDisabledReason,
    }]);
</script>
<PageActionFooter
    contentClass="export-page container-fluid py-4"
    rightButtons={rightActionButtons}
>
    <div class="col-lg-8">
        <!-- Header -->
        <div class="mb-4">
            <h1 class="h3 mb-0">Export</h1>
            <p class="text-muted mt-2 mb-0">Choose the filters to export your dataset.</p>
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
                <span>Include media in the export</span>
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
                onChange={onStatusChanged}
            />

            <!-- Institution Filter -->
            <InstitutionFilter
                items={data.institutions}
                bind:selectedInstitutions
                onChange={onInstitutionsChanged}
            />

            <!-- Connection Filters -->
            <ConnectionFilters
                {connectionFieldOptions}
                bind:connectionFilters
                onChange={onConnectionFiltersChanged}
            />

            <!-- Free Text Research Field Filters -->
            <ResearchFieldFilters
                {freeTextFieldOptions}
                bind:freeTextFilters
                onChange={onFreeTextFiltersChanged}
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
            />
        </div>
    </div>
</PageActionFooter>
