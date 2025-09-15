<script>
    import { page } from "$app/stores";
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";

    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import { searchObjects } from "$lib/stores/ObjectsUtils.js";
    import { onMount } from "svelte";
    import BaseImage from "$lib/components/base/BaseImage.svelte";
    import { getObjectIdentifier } from "$lib/utils/objects.js";

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
    let selectedObjects = $state(new Set());
    // NEW: facets from search response for dynamic counts
    let facets = $state({ institutions: [], statuses: [], researchFields: [] });
    // Track initial search completion to avoid duplicate fetch via effect
    let didInitialSearch = $state(false);

    // Helper: format date as DD-MM-YYYY
    function formatDate(value) {
        const d = new Date(+value);
        if (Number.isNaN(d.getTime())) return "";
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

    // Helper: get first image asset from object
    function getFirstImageAsset(object) {
        const list = object?.objectsAssets || [];
        const first =
            list.find(
                (oa) => oa?.asset?.type === "image" || oa?.type === "image",
            ) || list[0];
        const asset = first?.asset ?? first;
        return asset || null;
    }

    // Helper: resolve media url from asset preferring the "sm" format
    function getObjectPreviewUrl(object) {
        const asset = getFirstImageAsset(object);
        if (!asset) return null;
        try {
            let formats = asset.formats;
            if (typeof formats === "string") {
                try {
                    formats = JSON.parse(formats);
                } catch {
                    // ignore
                }
            }
            if (formats && formats.sm) {
                return `media://${formats.sm}`;
            }
            if (formats && (formats.md || formats.lg || formats.original)) {
                const fallback =
                    formats.sm || formats.md || formats.lg || formats.original;
                if (fallback) return `media://${fallback}`;
            }
            const p = Array.isArray(asset.path) ? asset.path[0] : asset.path;
            return p ? `media://${p}` : null;
        } catch (e) {
            console.warn("Failed to resolve preview url for asset", e);
            const p = Array.isArray(asset.path) ? asset.path[0] : asset.path;
            return p ? `media://${p}` : null;
        }
    }

    // Available options
    let exportFormats = [
        { value: "csv", label: "CSV" },
        { value: "json", label: "JSON" },
        { value: "sql", label: "SQLite" },
    ];

    let statusOptions = [
        { value: "all", label: "All" },
        { value: "completed", label: "Completed" },
        { value: "in progress", label: "In progress" },
    ];



    // Search function
    async function performSearch() {
        isLoading = true;
        try {
            const searchParams = {
                projectId,
                page: currentPage - 1, // Convert to 0-based for backend
                pageSize,
            };

            // Add status filter at top level (object search expects it here)
            if (selectedStatus !== "all") {
                searchParams.status = selectedStatus;
            }

            // Add institution filters at top level
            if (selectedInstitutions.length > 0) {
                searchParams.institutionIds = [...selectedInstitutions];
            }

            // Add research field filters at top level - ensure serializable
            if (researchFieldFilters.length > 0) {
                searchParams.researchFieldFilters = researchFieldFilters.map(
                    (filter) => {
                        const allowed = (researchFieldOptions.find(o => o.value === filter.fieldId)?.vocabOptions || []).map(v => v.value);
                        const vocab = (Array.isArray(filter.vocabularyIds) ? filter.vocabularyIds : []).filter(id => allowed.includes(id));
                        return {
                            fieldId: filter.fieldId,
                            query: filter.query || "",
                            vocabularyIds: vocab,
                        };
                    },
                );
            }

            console.log("Searching with params:", JSON.parse(JSON.stringify(searchParams)));
            const response = await searchObjects(searchParams);

            if (response.error) {
                console.error("Search error:", response.error);
                objects = [];
                totalCount = 0;
                facets = { institutions: [], statuses: [], researchFields: [] };
                selectedObjects = new Set();
            } else {
                objects = response.items || [];
                totalCount = response.totalCount || 0;
                facets = response.facets || {
                    institutions: [],
                    statuses: [],
                    researchFields: [],
                };
                // Select all by default for current results
                selectedObjects = new Set(objects.map((obj) => obj.id));
            }
        } catch (error) {
            console.error("Error searching objects:", error);
            objects = [];
            totalCount = 0;
            facets = { institutions: [], statuses: [], researchFields: [] };
            selectedObjects = new Set();
        } finally {
            isLoading = false;
        }
    }

    // Manual search trigger function
    function handleApplyFilters() {
        console.log("Apply filters clicked!");
        console.log("Current filters:", {
            selectedStatus,
            selectedInstitutions,
            researchFieldFilters,
        });
        currentPage = 1;
        performSearch();
    }

    // Trigger initial no-filter search on mount
    onMount(() => {
        console.log("Initial search on mount");
        // Mark completion so page-change effect doesn't double-fetch
        performSearch().finally(() => {
            didInitialSearch = true;
        });
    });

    // When currentPage changes via pagination, fetch that page
    $effect(() => {
        const p = currentPage; // track dependency
        if (!didInitialSearch) return;
        console.log("Page changed, fetching page", p);
        performSearch();
    });

    // Toggle object selection
    function toggleObjectSelection(objectId) {
        if (selectedObjects.has(objectId)) {
            selectedObjects.delete(objectId);
        } else {
            selectedObjects.add(objectId);
        }
        selectedObjects = new Set(selectedObjects);
    }

    // Toggle all objects selection
    function toggleAllObjects() {
        if (selectedObjects.size === objects.length) {
            selectedObjects.clear();
        } else {
            selectedObjects = new Set(objects.map((obj) => obj.id));
        }
        selectedObjects = new Set(selectedObjects);
    }

    // Get research fields from page data
    let researchFields = $derived.by(() => {
        const rf = data.researchFields;
        if (Array.isArray(rf)) return rf;               // Already an array
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
                       (Array.isArray(name?.translations) && name.translations[0]?.content) ??
                       String(field.id));
            return {
                value: field.id,
                label,
                group: field?.project?.title?.content ?? "Research Fields",
                vocabOptions: Array.isArray(field?.vocabularies) ? field.vocabularies.map(v => ({ value: v.id, label: v?.option?.content ?? v.id })) : [],
            };
        });
    });

    // Debugging: please paste these logs
    $inspect({ researchFields });
    $inspect({ researchFieldOptions });
    $inspect({ researchFieldFilters });

    // Remove research field filter
    function removeResearchFieldFilter(index) {
        researchFieldFilters = researchFieldFilters.filter(
            (_, i) => i !== index,
        );
    }

    // Handle export
    async function handleExport() {
        try {
            const exportOptions = {
                filters: {
                    project_id: projectId,
                    ...(selectedStatus !== "all" && { status: selectedStatus }),
                    ...(selectedInstitutions.length > 0 && {
                        institutionIds: selectedInstitutions,
                    }),
                    ...(researchFieldFilters.length > 0 && {
                        researchFieldFilters,
                    }),
                },
                includeAssets,
                format: selectedFormat,
            };

            // Call the backend export handler
            const result =
                await window.electronAPI.exportProject(exportOptions);

            if (result.canceled) {
                return;
            }

            console.log("Export completed:", result);
            // Show success message or handle result
        } catch (error) {
            console.error("Export failed:", error);
            // Show error message
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

    // Add research field filter
    function addResearchFieldFilter() {
        researchFieldFilters = [
            ...researchFieldFilters,
            {
                fieldId: researchFieldOptions.length > 0 ? researchFieldOptions[0]?.value : "",
                query: "",
                vocabularyIds: [],
            },
        ];
    }
</script>

<div class="export-page container-fluid py-4">
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
                    class="format-option d-inline-flex align-items-center gap-2 px-3 py-2 border rounded-2 cursor-pointer"
                >
                    <input
                        type="radio"
                        bind:group={selectedFormat}
                        value={format.value}
                    />
                    <span class="format-label">{format.label}</span>
                    {#if format.value === "csv"}
                        <span class="bi bi-table"></span>
                    {:else if format.value === "json"}
                        <span class="bi bi-braces"></span>
                    {:else if format.value === "sql"}
                        <span class="bi bi-database"></span>
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
        <div class="filter-group mb-3">
            <label class="filter-label fw-semibold mb-2 d-block">Status</label>
            <div class="status-options d-flex gap-2">
                {#each statusOptions as status}
                    <button
                        class="status-btn d-inline-flex align-items-center gap-1 px-3 py-1 border rounded-pill bg-white text-dark-emphasis cursor-pointer {selectedStatus ===
                        status.value
                            ? 'active border-primary bg-primary-subtle text-primary'
                            : ''}"
                        onclick={() => (selectedStatus = status.value)}
                    >
                        {status.label}
                        {#if status.value === "completed"}
                            <span class="status-count">{completedCount}</span>
                        {:else if status.value === "in progress"}
                            <span class="status-count">{inProgressCount}</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Institution Filter -->
        <div class="filter-group mb-3">
            <label class="filter-label fw-semibold mb-2 d-block"
                >Institution</label
            >
            <div class="institution-selection d-flex flex-column gap-2">
                <div class="selected-count text-body-secondary small">
                    {selectedInstitutions.length} selected
                </div>
                <BaseSelect
                    items={data.institutions}
                    bind:value={selectedInstitutions}
                    placeholder="Select institutions..."
                    type="multiple"
                    size="sm"
                />
                {#if selectedInstitutions.length > 0}
                    <div
                        class="selected-institutions d-flex flex-wrap gap-1 mt-1"
                    >
                        {#each selectedInstitutions as instId}
                            {@const institution = data.institutions.find(
                                (i) => i.value === instId,
                            )}
                            {#if institution}
                                <span
                                    class="institution-tag d-inline-flex align-items-center gap-1 px-2 py-1 bg-primary-subtle text-primary border border-primary-subtle rounded-pill"
                                >
                                    {institution.label}
                                    <button
                                        class="remove-tag bg-transparent border-0 text-primary cursor-pointer fs-6"
                                        onclick={() =>
                                            (selectedInstitutions =
                                                selectedInstitutions.filter(
                                                    (id) => id !== instId,
                                                ))}
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

        <!-- Research Field Filters -->
        <div class="filter-group">
            <label class="filter-label fw-semibold mb-2 d-block"
                >Research field</label
            >
            {#each researchFieldFilters as filter, index}
                {@const selectedField = researchFieldOptions.find(o => o.value === filter.fieldId)}
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
                class="add-filter mt-2 bg-primary-subtle border border-primary-subtle text-primary rounded-2 px-3 py-1 cursor-pointer"
                onclick={addResearchFieldFilter}
            >
                Add research field filter
            </button>
        </div>

        <!-- Apply Filters Button -->
        <div class="apply-filters mt-3 d-flex justify-content-end">
            <button
                class="apply-btn bg-primary text-white border-0 rounded-2 px-3 py-2 cursor-pointer"
                onclick={handleApplyFilters}
            >
                Apply Filters
            </button>
        </div>
    </div>

    <!-- Results Section -->
    <div class="results-section mt-4">
        <div
            class="summary d-flex align-items-center justify-content-between mb-3"
        >
            <div class="summary-left">
                <div class="summary-text text-body">{exportSummary}</div>
            </div>
            <div class="summary-right">
                <button
                    class="download-btn bg-success text-white border-0 rounded-2 px-3 py-2 cursor-pointer"
                    onclick={handleExport}
                >
                    Download export
                </button>
            </div>
        </div>

        <div
            class="table-container overflow-auto border border-light-subtle rounded-3"
        >
            <table class="objects-table w-100 border-collapse">
                <thead>
                    <tr>
                        <th class="checkbox-column" style="width: 40px;">
                            <input
                                type="checkbox"
                                checked={selectedObjects.size ===
                                    objects.length}
                                indeterminate={selectedObjects.size > 0 &&
                                    selectedObjects.size < objects.length}
                                onclick={toggleAllObjects}
                            />
                        </th>
                        <th class="image-column" style="width: 60px;"></th>
                        <th class="id-column" style="width: 140px;"
                            >Object ID</th
                        >

                        <th class="date-column" style="width: 140px;"
                            >Date modified</th
                        >
                    </tr>
                </thead>
                <tbody>
                    {#each objects as object}
                        <tr>
                            <td class="checkbox-column">
                                <input
                                    type="checkbox"
                                    checked={selectedObjects.has(object.id)}
                                    onclick={() =>
                                        toggleObjectSelection(object.id)}
                                />
                            </td>
                            <td class="image-column">
                                <BaseImage
                                    src={getObjectPreviewUrl(object)}
                                    alt={getObjectIdentifier(object)}
                                    width={48}
                                    height={48}
                                    class="rounded"
                                />
                            </td>
                            <td class="id-column"
                                ><span
                                    class="id-link text-primary text-decoration-underline cursor-default"
                                    >{getObjectIdentifier(object)}</span
                                ></td
                            >

                            <td class="date-column"
                                >{formatDate(object.updated_at)}</td
                            >
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>

        <div class="pagination-container mt-3">
            <BasePagination
                bind:page={currentPage}
                {pageSize}
                count={totalCount}
                size="sm"
            />
        </div>
    </div>
</div>

<style>
    /* Minimal remaining styles that can't be replaced with Bootstrap */
    .objects-table th,
    .objects-table td {
        border-bottom: 1px solid #f0f0f0;
        padding: 10px 12px;
        text-align: left;
    }

    .id-column {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
    }
</style>
