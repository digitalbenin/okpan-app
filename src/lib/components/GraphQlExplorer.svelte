<script>
  import { slide } from "svelte/transition";
  import {
    INTROSPECTION_QUERY,
    ADD_PROJECT_MUTATION,
    LIST_PROJECTS_QUERY,
    ADD_INSTITUTION_MUTATION,
    LIST_INSTITUTIONS_QUERY,
  } from "../utils/queries";

  let query = $state(`{
    project {
      id
      title
      description
      institutions {
        id
        name
        description
        country
        location
      }
    }
  }`);
  let result = $state("");
  let status = $state("");
  let selectedProjectId = $state("");

  // State for section visibility
  let activeSection = $state("projects");

  const toggleSection = (section) => {
    activeSection = activeSection === section ? "" : section;
  };

  const handleExecuteQuery = async () => {
    try {
      status = "Executing query...";
      let variables = {};

      // Add variables for specific operations
      if (query === ADD_INSTITUTION_MUTATION) {
        variables = { projectId: parseInt(selectedProjectId) };
      }

      const response = await window.api.executeGraphQL(query, variables);
      result = JSON.stringify(response, null, 2);
      status = response.success
        ? "Query executed successfully!"
        : "Query failed!";
    } catch (error) {
      result = JSON.stringify({ error: error.message }, null, 2);
      status = "Error executing query!";
    }
    setTimeout(() => {
      status = "";
    }, 3000);
  };

  const loadQuery = (queryText, operation) => {
    if (operation === "Add Institution" && !selectedProjectId) {
      status = "Please enter a project ID first!";
      setTimeout(() => {
        status = "";
      }, 3000);
      return;
    }

    query = queryText;
  };
</script>

<div class="container-fluid py-3">
  <div class="row">
    <div class="col-12">
      <h2 class="border-bottom pb-2 mb-4">
        <i class="bi bi-box-arrow-in-down-right me-2"></i>
        GraphQL API Explorer
      </h2>

      <div class="mb-4">
        <!-- Projects Section -->
        <div class="card mb-2">
          <div
            class="card-header cursor-pointer {activeSection === 'projects'
              ? 'bg-light'
              : ''}"
            onclick={() => toggleSection("projects")}
          >
            <div class="d-flex align-items-center">
              <i
                class="bi {activeSection === 'projects'
                  ? 'bi-chevron-down'
                  : 'bi-chevron-right'} me-2"
              ></i>
              <span class="badge bg-success me-2">GET</span>
              <span class="badge bg-primary me-2">POST</span>
              <strong>Projects</strong>
            </div>
          </div>
          {#if activeSection === "projects"}
            <div class="card-body" transition:slide>
              <div class="list-group">
                <!-- Add Project -->
                <div class="list-group-item">
                  <div
                    class="d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <span class="badge bg-primary me-2">POST</span>
                      <strong>Create Project</strong>
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline-primary btn-sm"
                      onclick={() =>
                        loadQuery(ADD_PROJECT_MUTATION, "Add project")}
                    >
                      Try it out
                    </button>
                  </div>
                  <div class="mt-2">
                    <small class="text-muted"
                      >Creates a new project with auto-generated title</small
                    >
                  </div>
                </div>
                <!-- List Projects -->
                <div class="list-group-item">
                  <div
                    class="d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <span class="badge bg-success me-2">GET</span>
                      <strong>List Projects</strong>
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline-success btn-sm"
                      onclick={() =>
                        loadQuery(LIST_PROJECTS_QUERY, "List projects")}
                    >
                      Try it out
                    </button>
                  </div>
                  <div class="mt-2">
                    <small class="text-muted"
                      >Retrieves all projects with their institutions</small
                    >
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Institutions Section -->
        <div class="card mb-2">
          <div
            class="card-header cursor-pointer {activeSection === 'institutions'
              ? 'bg-light'
              : ''}"
            onclick={() => toggleSection("institutions")}
          >
            <div class="d-flex align-items-center">
              <i
                class="bi {activeSection === 'institutions'
                  ? 'bi-chevron-down'
                  : 'bi-chevron-right'} me-2"
              ></i>
              <span class="badge bg-success me-2">GET</span>
              <span class="badge bg-primary me-2">POST</span>
              <strong>Institutions</strong>
            </div>
          </div>
          {#if activeSection === "institutions"}
            <div class="card-body" transition:slide>
              <div class="list-group">
                <!-- Add Institution -->
                <div class="list-group-item">
                  <div
                    class="d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <span class="badge bg-primary me-2">POST</span>
                      <strong>Create Institution</strong>
                    </div>
                    <div class="d-flex gap-2 align-items-center">
                      <div
                        class="input-group input-group-sm"
                        style="width: auto;"
                      >
                        <span class="input-group-text">Project ID</span>
                        <input
                          type="number"
                          class="form-control"
                          bind:value={selectedProjectId}
                          placeholder="Required"
                          style="width: 100px;"
                        />
                      </div>
                      <button
                        type="button"
                        class="btn btn-outline-primary btn-sm"
                        onclick={() =>
                          loadQuery(
                            ADD_INSTITUTION_MUTATION,
                            "Add Institution",
                          )}
                        disabled={!selectedProjectId}
                      >
                        Try it out
                      </button>
                    </div>
                  </div>
                  <div class="mt-2">
                    <small class="text-muted"
                      >Creates a new institution linked to a project</small
                    >
                  </div>
                </div>
                <!-- List Institutions -->
                <div class="list-group-item">
                  <div
                    class="d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <span class="badge bg-success me-2">GET</span>
                      <strong>List Institutions</strong>
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline-success btn-sm"
                      onclick={() =>
                        loadQuery(LIST_INSTITUTIONS_QUERY, "List institutions")}
                    >
                      Try it out
                    </button>
                  </div>
                  <div class="mt-2">
                    <small class="text-muted">Retrieves all institutions</small>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Schema Section -->
        <div class="card">
          <div
            class="card-header cursor-pointer {activeSection === 'schema'
              ? 'bg-light'
              : ''}"
            onclick={() => toggleSection("schema")}
          >
            <div class="d-flex align-items-center">
              <i
                class="bi {activeSection === 'schema'
                  ? 'bi-chevron-down'
                  : 'bi-chevron-right'} me-2"
              ></i>
              <span class="badge bg-secondary me-2">SCHEMA</span>
              <strong>GraphQL Schema</strong>
            </div>
          </div>
          {#if activeSection === "schema"}
            <div class="card-body" transition:slide>
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <strong>Introspection Query</strong>
                  <div class="mt-1">
                    <small class="text-muted"
                      >Retrieves the GraphQL schema structure</small
                    >
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  onclick={() => loadQuery(INTROSPECTION_QUERY, "Schema")}
                >
                  Try it out
                </button>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Query Editor Section -->
      <div class="card mb-4">
        <div class="card-header bg-light">
          <h5 class="card-title mb-0">Query Editor</h5>
        </div>
        <div class="card-body">
          <textarea
            id="queryEditor"
            class="form-control font-monospace mb-3"
            rows="8"
            bind:value={query}
            placeholder="Enter your GraphQL query here..."
          ></textarea>

          <button
            type="button"
            class="btn btn-primary"
            onclick={handleExecuteQuery}
          >
            <i class="bi bi-play-fill me-2"></i>
            Execute Query
          </button>

          {#if status}
            <div class="alert alert-info mt-3 mb-0" role="alert">
              {status}
            </div>
          {/if}
        </div>
      </div>

      <!-- Results Section -->
      <div class="card">
        <div class="card-header bg-light">
          <h5 class="card-title mb-0">Response</h5>
        </div>
        <div class="card-body">
          <textarea
            id="resultViewer"
            class="form-control font-monospace"
            rows="8"
            bind:value={result}
            readonly
            placeholder="Query results will appear here..."
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  textarea {
    white-space: pre;
    overflow-wrap: normal;
    overflow-x: scroll;
  }

  .cursor-pointer {
    cursor: pointer;
  }

  .cursor-pointer:hover {
    background-color: var(--bs-light);
  }

  .list-group-item {
    border-left: none;
    border-right: none;
  }

  .list-group-item:first-child {
    border-top: none;
  }

  .list-group-item:last-child {
    border-bottom: none;
  }
</style>
