<script>
    import { onMount } from "svelte";
    import { useGraphQL } from "$lib/stores/GraphqlUtils.js";
    import { API_SECTIONS } from "$lib/utils/queries.js";

    // Get GraphQL utilities
    const {
        partialUpdate,
        bulkUpdate,
        executeQuery,
        deleteEntity,
        bulkDelete,
    } = useGraphQL();

    // State for form inputs and results - using $state for reactivity
    let projectId = $state("");
    let newTitle = $state("");
    let newDescription = $state("");

    // Projects for bulk update
    let bulkProjects = $state([
        { projectId: "", title: "", description: "" },
        { projectId: "", title: "", description: "" },
    ]);

    // State for query results
    let projectWithCounts = $state(null);
    let institutions = $state([]);
    let totalInstitutions = $state(0);
    let page = $state(0);
    let pageSize = $state(5);

    // State for delete operations
    let institutionIdToDelete = $state("");
    let objectIdsToDelete = $state("");
    let deleteResult = $state(null);
    let bulkDeleteResult = $state(null);

    // State for objects list
    let objectsList = $state([]);
    let totalObjects = $state(0);

    // State for operation results
    let updateResult = $state(null);
    let bulkUpdateResult = $state(null);
    let queryResult = $state(null);
    let loading = $state({
        update: false,
        bulkUpdate: false,
        getProject: false,
        getInstitutions: false,
        getObjects: false,
        deleteInstitution: false,
        deleteObjects: false,
    });

    // Add a row for bulk update
    function addBulkProject() {
        bulkProjects = [
            ...bulkProjects,
            { projectId: "", title: "", description: "" },
        ];
    }

    // Remove a row from bulk update
    function removeBulkProject(index) {
        bulkProjects = bulkProjects.filter((_, i) => i !== index);
    }

    // Update a single project (partial update)
    async function updateProjectPartial() {
        if (!projectId) {
            alert("Please enter a project ID");
            return;
        }

        if (!newTitle && !newDescription) {
            alert("Please enter at least title or description");
            return;
        }

        loading.update = true;
        updateResult = null;

        try {
            // Only include fields that have values
            const params = { projectId };
            if (newTitle) params.title = newTitle;
            if (newDescription) params.description = newDescription;

            const result = await partialUpdate("projects", "update", params);
            updateResult = { success: true, data: result };
        } catch (error) {
            console.error("Failed to update project:", error);
            updateResult = { success: false, error: error.message };
        } finally {
            loading.update = false;
        }
    }

    // Bulk update multiple projects
    async function updateProjectsBulk() {
        const validProjects = bulkProjects.filter(
            (p) => p.projectId && (p.title || p.description),
        );

        if (validProjects.length === 0) {
            alert(
                "Please enter at least one valid project with ID and either title or description",
            );
            return;
        }

        loading.bulkUpdate = true;
        bulkUpdateResult = null;

        try {
            // Filter out empty fields for each project
            const projects = validProjects.map((p) => {
                const project = { projectId: p.projectId };
                if (p.title) project.title = p.title;
                if (p.description) project.description = p.description;
                return project;
            });

            const result = await bulkUpdate("projects", "update", projects);
            bulkUpdateResult = { success: true, data: result };
        } catch (error) {
            console.error("Failed to bulk update projects:", error);
            bulkUpdateResult = { success: false, error: error.message };
        } finally {
            loading.bulkUpdate = false;
        }
    }

    // Get project with counts using custom query
    async function getProject() {
        if (!projectId) {
            alert("Please enter a project ID");
            return;
        }

        loading.getProject = true;
        queryResult = null;

        try {
            const result = await executeQuery("projects", "getById", {
                projectId: projectId,
            });

            queryResult = { success: true };
            projectWithCounts = result.result;
        } catch (error) {
            console.error("Failed to get project:", error);
            queryResult = { success: false, error: error.message };
        } finally {
            loading.getProject = false;
        }
    }

    // Get paginated institutions list
    async function getInstitutions() {
        if (!projectId) {
            alert("Please enter a project ID");
            return;
        }

        loading.getInstitutions = true;

        try {
            const result = await executeQuery("institutions", "list", {
                projectId: projectId,
                page,
                pageSize,
                orderBy: "name",
                direction: "asc",
            });

            institutions = result.result || [];
            totalInstitutions = result.count || 0;
        } catch (error) {
            console.error("Failed to get institutions:", error);
            alert(`Error: ${error.message}`);
        } finally {
            loading.getInstitutions = false;
        }
    }

    // Change page in institutions list
    function changePage(newPage) {
        if (newPage >= 0 && newPage * pageSize < totalInstitutions) {
            page = newPage;
            getInstitutions();
        }
    }

    // Handle project ID input changes - useful for binding input to the state
    function handleProjectIdChange(event) {
        projectId = event.target.value;
    }

    // Handle title input changes
    function handleTitleChange(event) {
        newTitle = event.target.value;
    }

    // Handle description input changes
    function handleDescriptionChange(event) {
        newDescription = event.target.value;
    }

    // Update bulk project fields
    function updateBulkProject(index, field, value) {
        const updated = [...bulkProjects];
        updated[index] = { ...updated[index], [field]: value };
        bulkProjects = updated;
    }

    // Update page size
    function handlePageSizeChange(event) {
        pageSize = parseInt(event.target.value);
        if (page * pageSize >= totalInstitutions) {
            page = Math.max(0, Math.floor(totalInstitutions / pageSize) - 1);
        }
        if (institutions.length > 0) {
            getInstitutions();
        }
    }

    // Delete a single institution
    async function deleteInstitution() {
        if (!institutionIdToDelete) {
            alert("Please enter an institution ID to delete");
            return;
        }

        loading.deleteInstitution = true;
        deleteResult = null;

        try {
            const result = await deleteEntity("institutions", {
                institutionId: institutionIdToDelete,
            });
            deleteResult = { success: true, data: result };

            // Refresh institutions list if on the same project
            if (institutions.length > 0) {
                getInstitutions();
            }
        } catch (error) {
            console.error("Failed to delete institution:", error);
            deleteResult = { success: false, error: error.message };
        } finally {
            loading.deleteInstitution = false;
        }
    }

    // Bulk delete multiple objects
    async function deleteObjects() {
        if (!objectIdsToDelete) {
            alert("Please enter object IDs to delete (comma-separated)");
            return;
        }

        const objectIds = objectIdsToDelete
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id);

        if (objectIds.length === 0) {
            alert("No valid object IDs provided");
            return;
        }

        loading.deleteObjects = true;
        bulkDeleteResult = null;

        try {
            const objectsToDelete = objectIds.map((id) => ({ objectId: id }));
            const result = await bulkDelete("objects", objectsToDelete);
            bulkDeleteResult = { success: true, data: result };

            // Refresh objects list if any were loaded
            if (objectsList.length > 0) {
                getObjects();
            }
        } catch (error) {
            console.error("Failed to delete objects:", error);
            bulkDeleteResult = { success: false, error: error.message };
        } finally {
            loading.deleteObjects = false;
        }
    }

    // Get objects for a project
    async function getObjects() {
        if (!projectId) {
            alert("Please enter a project ID");
            return;
        }

        loading.getObjects = true;

        try {
            const result = await executeQuery("objects", "list", {
                projectId: projectId,
            });

            objectsList = result.result || [];
            totalObjects = objectsList.length;
        } catch (error) {
            console.error("Failed to get objects:", error);
            alert(`Error: ${error.message}`);
        } finally {
            loading.getObjects = false;
        }
    }
</script>

<svelte:head>
    <title>GraphQL Partial Updates Test</title>
</svelte:head>

<main class="container py-4">
    <div class="card mb-4">
        <div
            class="card-header d-flex justify-content-between align-items-center"
        >
            <h1 class="h3 mb-0">GraphQL Partial Updates Test</h1>
            <a href="/test/graphql" class="btn btn-outline-secondary btn-sm"
                >Back to GraphQL Tests</a
            >
        </div>
        <div class="card-body">
            <div class="mb-3">
                <label for="projectId" class="form-label">Project ID</label>
                <input
                    type="text"
                    id="projectId"
                    value={projectId}
                    on:input={handleProjectIdChange}
                    placeholder="Enter Project ID"
                    class="form-control"
                />
                <div class="form-text">
                    Enter a project ID to use in all operations below
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4 mb-4">
        <!-- Partial Update Section -->
        <div class="col-md-6">
            <div class="card h-100">
                <div class="card-header bg-primary bg-opacity-10">
                    <h2 class="h5 mb-0">Partial Update (PATCH style)</h2>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        <label for="newTitle" class="form-label"
                            >Title (optional)</label
                        >
                        <input
                            type="text"
                            id="newTitle"
                            value={newTitle}
                            on:input={handleTitleChange}
                            placeholder="New title"
                            class="form-control"
                        />
                    </div>

                    <div class="mb-3">
                        <label for="newDescription" class="form-label"
                            >Description (optional)</label
                        >
                        <textarea
                            id="newDescription"
                            value={newDescription}
                            on:input={handleDescriptionChange}
                            placeholder="New description"
                            class="form-control"
                            rows="3"
                        ></textarea>
                    </div>

                    <button
                        on:click={updateProjectPartial}
                        class="btn btn-primary"
                        disabled={loading.update}
                    >
                        {loading.update
                            ? "Updating..."
                            : "Update Project (Partial)"}
                    </button>

                    {#if updateResult}
                        <div
                            class="alert mt-3 {updateResult.success
                                ? 'alert-success'
                                : 'alert-danger'}"
                        >
                            <div class="fw-bold">
                                {updateResult.success ? "Success!" : "Error!"}
                            </div>
                            <pre
                                class="mt-2 small bg-light p-2 rounded"
                                style="max-height: 200px; overflow: auto;">{JSON.stringify(
                                    updateResult,
                                    null,
                                    2,
                                )}</pre>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Bulk Update Section -->
        <div class="col-md-6">
            <div class="card h-100">
                <div class="card-header bg-primary bg-opacity-10">
                    <h2 class="h5 mb-0">Bulk Update</h2>
                </div>
                <div class="card-body">
                    <div class="mb-3">
                        {#each bulkProjects as project, i}
                            <div class="row g-2 mb-2 align-items-center">
                                <div class="col">
                                    <input
                                        type="text"
                                        value={project.projectId}
                                        on:input={(e) =>
                                            updateBulkProject(
                                                i,
                                                "projectId",
                                                e.target.value,
                                            )}
                                        placeholder="Project ID"
                                        class="form-control form-control-sm"
                                    />
                                </div>
                                <div class="col">
                                    <input
                                        type="text"
                                        value={project.title}
                                        on:input={(e) =>
                                            updateBulkProject(
                                                i,
                                                "title",
                                                e.target.value,
                                            )}
                                        placeholder="Title"
                                        class="form-control form-control-sm"
                                    />
                                </div>
                                <div class="col">
                                    <input
                                        type="text"
                                        value={project.description}
                                        on:input={(e) =>
                                            updateBulkProject(
                                                i,
                                                "description",
                                                e.target.value,
                                            )}
                                        placeholder="Description"
                                        class="form-control form-control-sm"
                                    />
                                </div>
                                <div class="col-auto">
                                    <button
                                        on:click={() => removeBulkProject(i)}
                                        class="btn btn-danger btn-sm"
                                        title="Remove"
                                    >
                                        <i class="bi bi-x"></i>
                                    </button>
                                </div>
                            </div>
                        {/each}

                        <button
                            on:click={addBulkProject}
                            class="btn btn-outline-primary btn-sm mt-2"
                        >
                            <i class="bi bi-plus"></i> Add another project
                        </button>
                    </div>

                    <button
                        on:click={updateProjectsBulk}
                        class="btn btn-primary"
                        disabled={loading.bulkUpdate}
                    >
                        {loading.bulkUpdate
                            ? "Updating..."
                            : "Bulk Update Projects"}
                    </button>

                    {#if bulkUpdateResult}
                        <div
                            class="alert mt-3 {bulkUpdateResult.success
                                ? 'alert-success'
                                : 'alert-danger'}"
                        >
                            <div class="fw-bold">
                                {bulkUpdateResult.success
                                    ? "Success!"
                                    : "Error!"}
                            </div>
                            <pre
                                class="mt-2 small bg-light p-2 rounded"
                                style="max-height: 200px; overflow: auto;">{JSON.stringify(
                                    bulkUpdateResult,
                                    null,
                                    2,
                                )}</pre>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4">
        <!-- Get Project with Counts Section -->
        <div class="col-md-6">
            <div class="card h-100">
                <div class="card-header bg-success bg-opacity-10">
                    <h2 class="h5 mb-0">Get Project with Counts</h2>
                </div>
                <div class="card-body">
                    <button
                        on:click={getProject}
                        class="btn btn-success mb-3"
                        disabled={loading.getProject}
                    >
                        {loading.getProject
                            ? "Loading..."
                            : "Get Project with Counts"}
                    </button>

                    {#if projectWithCounts}
                        <div class="card mt-3">
                            <div class="card-body">
                                <h3 class="h5 card-title">
                                    {projectWithCounts.title?.content ||
                                        "No Title"}
                                </h3>
                                <p class="card-text text-muted">
                                    {projectWithCounts.description?.content ||
                                        "No Description"}
                                </p>

                                <div class="row g-3 mt-3">
                                    <div class="col-4">
                                        <div class="card text-center py-2">
                                            <div class="h4 mb-0">
                                                {projectWithCounts.institutionsCount}
                                            </div>
                                            <div class="small">
                                                Institutions
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-4">
                                        <div class="card text-center py-2">
                                            <div class="h4 mb-0">
                                                {projectWithCounts.objectsCount}
                                            </div>
                                            <div class="small">Objects</div>
                                        </div>
                                    </div>
                                    <div class="col-4">
                                        <div class="card text-center py-2">
                                            <div class="h4 mb-0">
                                                {projectWithCounts.assetsCount}
                                            </div>
                                            <div class="small">Assets</div>
                                        </div>
                                    </div>
                                </div>

                                <div class="mt-3 small text-muted">
                                    <div>
                                        Created: {new Date(
                                            projectWithCounts.created_at,
                                        ).toLocaleString()}
                                    </div>
                                    <div>
                                        Updated: {new Date(
                                            projectWithCounts.updated_at,
                                        ).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    {/if}

                    {#if queryResult && !queryResult.success}
                        <div class="alert alert-danger mt-3">
                            <div class="fw-bold">Error!</div>
                            <div>{queryResult.error}</div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Get Institutions List (Paginated) Section -->
        <div class="col-md-6">
            <div class="card h-100">
                <div class="card-header bg-success bg-opacity-10">
                    <h2 class="h5 mb-0">Get Institutions (Paginated)</h2>
                </div>
                <div class="card-body">
                    <div class="row g-2 align-items-end mb-3">
                        <div class="col-auto">
                            <label for="pageSize" class="form-label"
                                >Page Size</label
                            >
                            <select
                                id="pageSize"
                                value={pageSize}
                                on:change={handlePageSizeChange}
                                class="form-select"
                            >
                                <option value="5">5</option>
                                <option value="10">10</option>
                                <option value="20">20</option>
                            </select>
                        </div>

                        <div class="col">
                            <button
                                on:click={getInstitutions}
                                class="btn btn-success w-100"
                                disabled={loading.getInstitutions}
                            >
                                {loading.getInstitutions
                                    ? "Loading..."
                                    : "Get Institutions"}
                            </button>
                        </div>
                    </div>

                    {#if institutions.length > 0}
                        <div>
                            <div class="small text-muted mb-2">
                                Showing {page * pageSize + 1}-{Math.min(
                                    (page + 1) * pageSize,
                                    totalInstitutions,
                                )} of {totalInstitutions} institutions
                            </div>

                            <div class="list-group mb-3">
                                {#each institutions as institution}
                                    <div class="list-group-item">
                                        <div class="fw-bold">
                                            {institution.name?.content ||
                                                "No Name"}
                                        </div>
                                        <div class="small text-muted">
                                            {institution.location?.content ||
                                                "No Location"}, {institution
                                                .country?.content ||
                                                "No Country"}
                                        </div>
                                        <div
                                            class="d-flex gap-3 mt-1 small text-muted"
                                        >
                                            <span
                                                >Objects: {institution.objectsCount}</span
                                            >
                                            <span
                                                >Assets: {institution.assetsCount}</span
                                            >
                                            <span
                                                >Datasources: {institution.datasourcesCount}</span
                                            >
                                        </div>
                                    </div>
                                {/each}
                            </div>

                            <nav aria-label="Pagination">
                                <ul class="pagination justify-content-center">
                                    <li
                                        class="page-item {page === 0
                                            ? 'disabled'
                                            : ''}"
                                    >
                                        <button
                                            class="page-link"
                                            on:click={() =>
                                                changePage(page - 1)}
                                            disabled={page === 0}
                                        >
                                            Previous
                                        </button>
                                    </li>

                                    <li class="page-item active">
                                        <span class="page-link"
                                            >Page {page + 1}</span
                                        >
                                    </li>

                                    <li
                                        class="page-item {(page + 1) *
                                            pageSize >=
                                        totalInstitutions
                                            ? 'disabled'
                                            : ''}"
                                    >
                                        <button
                                            class="page-link"
                                            on:click={() =>
                                                changePage(page + 1)}
                                            disabled={(page + 1) * pageSize >=
                                                totalInstitutions}
                                        >
                                            Next
                                        </button>
                                    </li>
                                </ul>
                            </nav>
                        </div>
                    {:else if !loading.getInstitutions && institutions.length === 0 && totalInstitutions > 0}
                        <div class="alert alert-info">
                            No institutions found. Try changing the page or page
                            size.
                        </div>
                    {:else if !loading.getInstitutions && institutions.length === 0}
                        <div class="alert alert-secondary">
                            No institutions to display. Click "Get Institutions"
                            to load data.
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    </div>

    <!-- Delete Operations Section -->
    <div class="card mb-4">
        <div class="card-header bg-danger text-white">
            <h2 class="h4 mb-0">Delete Operations</h2>
        </div>
        <div class="card-body">
            <div class="row">
                <!-- Delete Institution Section -->
                <div class="col-md-6 mb-4">
                    <h3 class="h5 mb-3">Delete Institution</h3>

                    <div class="mb-3">
                        <label for="institutionId" class="form-label"
                            >Institution ID</label
                        >
                        <input
                            type="text"
                            id="institutionId"
                            class="form-control"
                            bind:value={institutionIdToDelete}
                            placeholder="Enter Institution ID"
                        />
                    </div>

                    <button
                        on:click={deleteInstitution}
                        class="btn btn-danger"
                        disabled={loading.deleteInstitution}
                    >
                        {loading.deleteInstitution
                            ? "Deleting..."
                            : "Delete Institution"}
                    </button>

                    {#if deleteResult}
                        <div
                            class="mt-3 p-2 rounded {deleteResult.success
                                ? 'bg-success-subtle'
                                : 'bg-danger-subtle'}"
                        >
                            <p class="fw-bold">
                                {deleteResult.success ? "Success!" : "Error!"}
                            </p>
                            <pre
                                class="small overflow-auto"
                                style="max-height: 150px;">{JSON.stringify(
                                    deleteResult,
                                    null,
                                    2,
                                )}</pre>
                        </div>
                    {/if}
                </div>

                <!-- Bulk Delete Objects Section -->
                <div class="col-md-6 mb-4">
                    <h3 class="h5 mb-3">Bulk Delete Objects</h3>

                    <div class="mb-3">
                        <label for="objectIds" class="form-label"
                            >Object IDs (comma-separated)</label
                        >
                        <textarea
                            id="objectIds"
                            class="form-control"
                            bind:value={objectIdsToDelete}
                            placeholder="Enter Object IDs separated by commas"
                            rows="3"
                        ></textarea>
                    </div>

                    <button
                        on:click={deleteObjects}
                        class="btn btn-danger"
                        disabled={loading.deleteObjects}
                    >
                        {loading.deleteObjects
                            ? "Deleting..."
                            : "Delete Objects"}
                    </button>

                    {#if bulkDeleteResult}
                        <div
                            class="mt-3 p-2 rounded {bulkDeleteResult.success
                                ? 'bg-success-subtle'
                                : 'bg-danger-subtle'}"
                        >
                            <p class="fw-bold">
                                {bulkDeleteResult.success
                                    ? "Success!"
                                    : "Error!"}
                            </p>
                            <pre
                                class="small overflow-auto"
                                style="max-height: 150px;">{JSON.stringify(
                                    bulkDeleteResult,
                                    null,
                                    2,
                                )}</pre>
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Object List for Reference -->
            <div class="mt-4">
                <div
                    class="d-flex justify-content-between align-items-center mb-3"
                >
                    <h3 class="h5 mb-0">Objects List</h3>
                    <button
                        on:click={getObjects}
                        class="btn btn-outline-secondary btn-sm"
                        disabled={loading.getObjects}
                    >
                        {loading.getObjects ? "Loading..." : "Load Objects"}
                    </button>
                </div>

                {#if objectsList.length > 0}
                    <div class="table-responsive">
                        <table class="table table-sm table-striped">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Status</th>
                                    <th>Institution</th>
                                    <th>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each objectsList as object}
                                    <tr>
                                        <td><small>{object.id}</small></td>
                                        <td>{object.status || "N/A"}</td>
                                        <td
                                            >{object.institution?.name
                                                ?.content || "Unknown"}</td
                                        >
                                        <td
                                            >{new Date(
                                                object.created_at,
                                            ).toLocaleString()}</td
                                        >
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                    <p class="text-muted small">
                        Total: {totalObjects} objects
                    </p>
                {:else if !loading.getObjects}
                    <p class="text-muted">
                        No objects found. Click "Load Objects" to fetch data.
                    </p>
                {/if}
            </div>
        </div>
    </div>
</main>

<style>
    /* Add any custom styles here if needed */
    pre {
        white-space: pre-wrap;
        word-break: break-all;
    }
</style>
