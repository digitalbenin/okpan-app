<script>
  import { slide } from "svelte/transition";
  import { API_SECTIONS } from "../utils/queries";

  let query = $state("");
  let result = $state("");
  let status = $state("");
  let selectedProjectId = $state("");
  let activeSection = $state("");

  const toggleSection = (sectionId) => {
    activeSection = activeSection === sectionId ? "" : sectionId;
  };

  const loadQuery = (operation) => {
    if (operation.requiresProjectId && !selectedProjectId) {
      status = "Please enter a project ID first!";
      setTimeout(() => {
        status = "";
      }, 3000);
      return;
    }

    query = operation.query;
  };

  const handleExecuteQuery = async () => {
    try {
      status = "Executing query...";
      let variables = {};

      // Add variables for operations that need them
      if (query.includes("$projectId")) {
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
</script>

<div class="container-fluid py-3">
  <div class="row">
    <div class="col-12">
      <h2 class="border-bottom pb-2 mb-4">
        <i class="bi bi-box-arrow-in-down-right me-2"></i>
        GraphQL API Explorer
      </h2>

      <div class="mb-4">
        {#each Object.entries(API_SECTIONS) as [sectionId, section]}
          <div class="card mb-2">
            <div
              class="card-header cursor-pointer {activeSection === sectionId
                ? 'bg-light'
                : ''}"
              onclick={() => toggleSection(sectionId)}
            >
              <div class="d-flex align-items-center">
                <i
                  class="bi {activeSection === sectionId
                    ? 'bi-chevron-down'
                    : 'bi-chevron-right'} me-2"
                ></i>
                {#if section.operations.some((op) => op.type === "query")}
                  <span class="badge bg-success me-2">GET</span>
                {/if}
                {#if section.operations.some((op) => op.type === "mutation")}
                  <span class="badge bg-primary me-2">POST</span>
                {/if}
                {#if section.operations.some((op) => op.type === "schema")}
                  <span class="badge bg-secondary me-2">SCHEMA</span>
                {/if}
                <strong>{section.name}</strong>
              </div>
            </div>

            {#if activeSection === sectionId}
              <div class="card-body" transition:slide>
                <div class="list-group">
                  {#each section.operations as operation}
                    <div class="list-group-item">
                      <div
                        class="d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <span
                            class="badge {operation.type === 'mutation'
                              ? 'bg-primary'
                              : operation.type === 'query'
                                ? 'bg-success'
                                : 'bg-secondary'} me-2"
                          >
                            {operation.type === "mutation"
                              ? "POST"
                              : operation.type === "query"
                                ? "GET"
                                : "SCHEMA"}
                          </span>
                          <strong>{operation.name}</strong>
                        </div>
                        <div class="d-flex gap-2 align-items-center">
                          {#if operation.requiresProjectId}
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
                          {/if}
                          <button
                            type="button"
                            class="btn btn-outline-{operation.type ===
                            'mutation'
                              ? 'primary'
                              : operation.type === 'query'
                                ? 'success'
                                : 'secondary'} btn-sm"
                            onclick={() => loadQuery(operation)}
                            disabled={operation.requiresProjectId &&
                              !selectedProjectId}
                          >
                            Try it out
                          </button>
                        </div>
                      </div>
                      <div class="mt-2">
                        <small class="text-muted">{operation.description}</small
                        >
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
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
            disabled={!query}
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
