<script>
    import { page } from "$app/stores";
    import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";

    import BasePagination from "$lib/components/base/BasePagination.svelte";
    import { searchObjects } from "$lib/stores/ObjectsUtils.js";

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

    // Available options
    let exportFormats = [
        { value: "csv", label: "CSV" },
        { value: "json", label: "JSON" },
        { value: "sql", label: "SQLite" },
    ];

    let statusOptions = [
        { value: "all", label: "All" },
        { value: "completed", label: "Completed" },
        { value: "in_progress", label: "In progress" },
    ];

    let researchFieldOptions = [
        { value: "designations", label: "Designations" },
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
                    (filter) => ({
                        fieldId: filter.fieldId,
                        query: filter.query || "",
                        vocabularyIds: filter.vocabularyIds || [],
                    }),
                );
            }

            console.log("Searching with params:", searchParams);
            const response = await searchObjects(searchParams);

            if (response.error) {
                console.error("Search error:", response.error);
                objects = [];
                totalCount = 0;
            } else {
                objects = response.items || [];
                totalCount = response.totalCount || 0;
            }
        } catch (error) {
            console.error("Error searching objects:", error);
            objects = [];
            totalCount = 0;
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

    // Add research field filter
    function addResearchFieldFilter() {
        researchFieldFilters = [
            ...researchFieldFilters,
            {
                fieldId: "designations",
                query: "",
                vocabularyIds: [],
            },
        ];
    }

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
    let totalPages = $derived(Math.ceil(totalCount / pageSize));
    let selectedCount = $derived(selectedObjects.size);
    let exportSummary = $derived(
        `You are about to export ${selectedCount} institutions, ${selectedCount} object, ${includeAssets ? selectedCount : 0} media`,
    );
</script>

<div class="export-page">
    <!-- Header -->
    <div class="header">
        <h2>Export</h2>
        <p class="subtitle">Choose the filters to export your dataset.</p>
    </div>

    <!-- Export Format Selection -->
    <div class="export-format-section">
        <h5>Export as</h5>
        <div class="format-options">
            {#each exportFormats as format}
                <label class="format-option">
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
    <div class="assets-section">
        <label class="asset-option">
            <input type="checkbox" bind:checked={includeAssets} />
            <span>Include assets in the export</span>
        </label>
    </div>

    <!-- Filter Content Section -->
    <div class="filter-section">
        <h5>Filter content</h5>

        <!-- Status Filter -->
        <div class="filter-group">
            <label class="filter-label">Status</label>
            <div class="status-options">
                {#each statusOptions as status}
                    <button
                        class="status-btn {selectedStatus === status.value
                            ? 'active'
                            : ''}"
                        onclick={() => (selectedStatus = status.value)}
                    >
                        {status.label}
                        {#if status.value === "completed"}
                            <span class="status-count">58</span>
                        {:else if status.value === "in_progress"}
                            <span class="status-count">34</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <!-- Institution Filter -->
        <div class="filter-group">
            <label class="filter-label">Institution</label>
            <div class="institution-selection">
                <div class="selected-count">
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
                    <div class="selected-institutions">
                        {#each selectedInstitutions as instId}
                            {@const institution = data.institutions.find(
                                (i) => i.value === instId,
                            )}
                            {#if institution}
                                <span class="institution-tag">
                                    {institution.label}
                                    <button
                                        class="remove-tag"
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
            <label class="filter-label">Research field</label>
            {#each researchFieldFilters as filter, index}
                <div class="research-field-filter">
                    <div class="field-row">
                        <BaseSelect
                            items={researchFieldOptions}
                            bind:value={filter.fieldId}
                            placeholder="Select field..."
                            type="single"
                            size="sm"
                        />
                        <span class="arrow">→</span>
                        <input
                            type="text"
                            class="value-input"
                            bind:value={filter.query}
                            placeholder="Ada, Value2"
                        />
                        <button
                            class="remove-filter"
                            onclick={() => removeResearchFieldFilter(index)}
                        >
                            ×
                        </button>
                    </div>
                    <div class="field-options">
                        <BaseSelect
                            items={[{ value: "all", label: "All" }]}
                            value="all"
                            placeholder="Select..."
                            type="single"
                            size="sm"
                        />
                    </div>
                </div>
            {/each}
            <button class="add-field-button" onclick={addResearchFieldFilter}>
                Add field
            </button>
        </div>

        <!-- Apply Button -->
        <div class="apply-section">
            <button
                class="apply-button"
                onclick={handleApplyFilters}
                disabled={isLoading}
            >
                {isLoading ? "Searching..." : "Apply Filters"}
            </button>
        </div>
    </div>

    <!-- Preview Section -->
    <div class="preview-section">
        <h5>Preview</h5>
        {#if isLoading}
            <div class="loading-state">
                <div class="spinner"></div>
                <span>Loading...</span>
            </div>
        {:else if objects.length === 0}
            <div class="empty-state">
                <p>No objects found matching the current filters.</p>
            </div>
        {:else}
            <div class="preview-table">
                <div class="table-header">
                    <label class="select-all">
                        <input
                            type="checkbox"
                            checked={selectedObjects.size === objects.length &&
                                objects.length > 0}
                            onchange={toggleAllObjects}
                        />
                    </label>
                    <span class="column-header">Object ID</span>
                    <span class="column-header">Date modified</span>
                </div>
                {#each objects as object}
                    <div class="table-row">
                        <label class="row-checkbox">
                            <input
                                type="checkbox"
                                checked={selectedObjects.has(object.id)}
                                onchange={() =>
                                    toggleObjectSelection(object.id)}
                            />
                        </label>
                        <div class="object-info">
                            <div class="object-icon">
                                {#if object.status === "completed"}
                                    <span class="status-icon completed"></span>
                                {:else}
                                    <span class="status-icon default"></span>
                                {/if}
                            </div>
                            <span class="object-id">{object.id}</span>
                        </div>
                        <span class="date-modified"
                            >{object.updated_at || "23-09-2024"}</span
                        >
                    </div>
                {/each}
            </div>

            <!-- Pagination -->
            {#if totalPages > 1}
                <div class="pagination-wrapper">
                    <BasePagination
                        bind:page={currentPage}
                        {pageSize}
                        count={totalCount}
                        size="sm"
                    />
                </div>
            {/if}
        {/if}

        <!-- Export Summary -->
        <div class="export-summary">
            <p>{exportSummary}</p>
        </div>
    </div>

    <!-- Action Buttons -->
    <div class="action-buttons">
        <button class="cancel-button" onclick={() => history.back()}>
            Cancel
        </button>
        <button
            class="download-button"
            disabled={selectedObjects.size === 0 || isLoading}
            onclick={handleExport}
        >
            {#if isLoading}
                <span class="spinner-sm"></span>
            {/if}
            Download
        </button>
    </div>
</div>

<style>
    .export-page {
        padding: 2rem;
        max-width: 800px;
        margin: 0 auto;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            sans-serif;
    }

    .header {
        margin-bottom: 2rem;
    }

    .header h2 {
        margin: 0 0 0.5rem 0;
        font-size: 1.5rem;
        font-weight: 600;
    }

    .subtitle {
        color: #666;
        margin: 0;
    }

    .export-format-section,
    .assets-section,
    .filter-section,
    .preview-section {
        margin-bottom: 2rem;
    }

    .export-format-section h5,
    .assets-section h5,
    .filter-section h5,
    .preview-section h5 {
        margin: 0 0 1rem 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .apply-section {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid #e5e7eb;
        display: flex;
        justify-content: center;
    }

    .apply-button {
        background-color: #3b82f6;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .apply-button:hover:not(:disabled) {
        background-color: #2563eb;
    }

    .apply-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
    }

    .add-field-button {
        background-color: transparent;
        color: #6b7280;
        border: 1px solid #d1d5db;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        font-size: 0.875rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .add-field-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
    }

    .cancel-button {
        background-color: transparent;
        color: #6b7280;
        border: 1px solid #d1d5db;
        padding: 0.75rem 1.5rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .cancel-button:hover {
        background-color: #f9fafb;
        border-color: #9ca3af;
    }

    .download-button {
        background-color: #3b82f6;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 0.375rem;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .download-button:hover:not(:disabled) {
        background-color: #2563eb;
    }

    .download-button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
    }

    .format-options {
        display: flex;
        gap: 1rem;
    }

    .format-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: white;
    }

    .format-option:has(input:checked) {
        border-color: #007bff;
        background-color: #f0f8ff;
    }

    .format-icon {
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 2px;
        font-size: 12px;
        font-weight: bold;
    }

    .csv-icon {
        background-color: #28a745;
    }

    .json-icon {
        background-color: #6f42c1;
        color: white;
    }

    .sql-icon {
        background-color: #17a2b8;
    }

    .asset-option {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
    }

    .filter-group {
        margin-bottom: 1.5rem;
    }

    .filter-label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
    }

    .status-options {
        display: flex;
        gap: 0.5rem;
    }

    .status-btn {
        padding: 0.5rem 1rem;
        border: 1px solid #ddd;
        background: white;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .status-btn.active {
        border-color: #007bff;
        background-color: #007bff;
        color: white;
    }

    .status-count {
        background-color: rgba(255, 255, 255, 0.2);
        padding: 0.2rem 0.4rem;
        border-radius: 10px;
        font-size: 0.8rem;
    }

    .status-btn:not(.active) .status-count {
        background-color: #f8f9fa;
        color: #666;
    }

    .institution-selection {
        position: relative;
    }

    .selected-count {
        font-size: 0.9rem;
        color: #666;
        margin-bottom: 0.5rem;
    }

    .selected-institutions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
    }

    .institution-tag {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.25rem 0.5rem;
        background-color: #e9ecef;
        border-radius: 12px;
        font-size: 0.8rem;
    }

    .remove-tag {
        background: none;
        border: none;
        cursor: pointer;
        color: #666;
        font-size: 1rem;
        line-height: 1;
    }

    .research-field-filter {
        margin-bottom: 1rem;
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .field-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .arrow {
        color: #666;
    }

    .value-input {
        flex: 1;
        padding: 0.375rem 0.75rem;
        border: 1px solid #ced4da;
        border-radius: 0.25rem;
    }

    .remove-filter {
        background: none;
        border: none;
        cursor: pointer;
        color: #dc3545;
        font-size: 1.2rem;
        line-height: 1;
    }

    .field-options {
        display: flex;
        gap: 0.5rem;
    }

    .preview-table {
        border: 1px solid #ddd;
        border-radius: 4px;
        overflow: hidden;
    }

    .table-header {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        gap: 1rem;
        padding: 0.75rem 1rem;
        background-color: #f8f9fa;
        border-bottom: 1px solid #ddd;
        font-weight: 500;
    }

    .table-row {
        display: grid;
        grid-template-columns: 40px 1fr auto;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #eee;
        align-items: center;
    }

    .table-row:last-child {
        border-bottom: none;
    }

    .object-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .object-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .status-icon {
        width: 16px;
        height: 16px;
        border-radius: 50%;
    }

    .status-icon.completed {
        background-color: #28a745;
    }

    .status-icon.default {
        background-color: #6c757d;
    }

    .object-id {
        color: #007bff;
        text-decoration: underline;
        cursor: pointer;
    }

    .date-modified {
        color: #666;
        font-size: 0.9rem;
    }

    .pagination-wrapper {
        display: flex;
        justify-content: center;
        margin-top: 1rem;
    }

    .export-summary {
        margin-top: 1rem;
        padding: 1rem;
        background-color: #f8f9fa;
        border-radius: 4px;
        text-align: center;
    }

    .action-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
        margin-top: 2rem;
    }

    .loading-state,
    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        color: #666;
    }

    .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 0.5rem;
    }

    .spinner-sm {
        width: 16px;
        height: 16px;
        border: 2px solid transparent;
        border-top: 2px solid currentColor;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 0.5rem;
    }

    .download-icon {
        margin-left: 0.5rem;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }
</style>
