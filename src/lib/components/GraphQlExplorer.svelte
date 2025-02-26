<script>
  import { slide } from "svelte/transition";
  import { API_SECTIONS } from "../utils/queries";

  let query = $state("");
  let result = $state("");
  let status = $state("");
  let activeSection = $state("");
  let variables = $state({});
  let currentOperationId = $state(null); // Store ID instead of the full operation object

  const sortOperations = (operations) => {
    const typeOrder = { query: 1, mutation: 2, schema: 3 };
    return [...operations].sort(
      (a, b) => typeOrder[a.type] - typeOrder[b.type],
    );
  };

  const toggleSection = (sectionId) => {
    activeSection = activeSection === sectionId ? "" : sectionId;
    // Reset variables when changing sections
    variables = {};
    currentOperationId = null;
  };

  const loadQuery = (operation, operationId) => {
    currentOperationId = operationId;
    variables = {}; // Reset variables when loading a new query

    if (operation.mutations) {
      // For mutation sequences, show a preview of all mutations
      query = operation.mutations.map((m) => m.query).join("\n\n");
    } else {
      query = operation.query;
    }
  };

  const coerceVariableValue = (value, varName, operation) => {
    if (!operation?.variables) return value;

    // For mutation sequences, check the first mutation that uses this variable
    if (operation.mutations) {
      const mutation = operation.mutations.find((m) =>
        m.useVariables?.includes(varName),
      );
      if (!mutation) return value;

      const typeMatch = mutation.query.match(
        new RegExp(`\\$${varName}:\\s*(\\w+)!?`),
      );
      if (!typeMatch) return value;

      const type = typeMatch[1];
      switch (type) {
        case "Int":
          return value === "" ? 0 : parseInt(value, 10);
        case "Float":
          return value === "" ? 0.0 : parseFloat(value);
        case "Boolean":
          return Boolean(value);
        default:
          return value;
      }
    }

    // For regular queries/mutations
    const typeMatch = operation.query?.match(
      new RegExp(`\\$${varName}:\\s*(\\w+)!?`),
    );
    if (!typeMatch) return value;

    const type = typeMatch[1];
    switch (type) {
      case "Int":
        return value === "" ? 0 : parseInt(value, 10);
      case "Float":
        return value === "" ? 0.0 : parseFloat(value);
      case "Boolean":
        return Boolean(value);
      default:
        return value;
    }
  };

  const handleExecuteQuery = async (operation) => {
    try {
      status = "Executing query...";

      // Coerce variable values to their correct types
      const queryVariables = Object.entries(variables).reduce(
        (acc, [key, value]) => {
          acc[key] = coerceVariableValue(value, key, operation);
          return acc;
        },
        {},
      );

      // Handle mutation sequences
      if (operation?.mutations) {
        let results = {};

        for (const mutation of operation.mutations) {
          // Prepare variables for this mutation
          const mutationVars = {};

          // Add variables from the UI that this mutation needs
          if (mutation.useVariables) {
            for (const varName of mutation.useVariables) {
              if (varName in queryVariables) {
                mutationVars[varName] = queryVariables[varName];
              }
            }
          }

          // Add mapped variables from previous mutation results
          if (mutation.mapVariables) {
            for (const [varName, mapping] of Object.entries(
              mutation.mapVariables,
            )) {
              const value = mapping.path
                .split(".")
                .reduce((obj, key) => obj?.[key], results[mapping.from]);
              if (value !== undefined) {
                mutationVars[varName] = value;
              } else {
                throw new Error(
                  `Could not map variable ${varName} from ${mapping.from} using path ${mapping.path}`,
                );
              }
            }
          }

          // Execute the mutation
          const response = await window.api.executeGraphQL(
            mutation.query,
            mutationVars,
          );
          if (!response.success) {
            throw new Error(
              `Mutation ${mutation.name} failed: ${JSON.stringify(response.errors)}`,
            );
          }

          // Store the result
          results[mutation.name] = response.data;
        }

        result = JSON.stringify(results, null, 2);
        status = "Mutations executed successfully!";
      } else {
        // Handle regular query/mutation
        const response = await window.api.executeGraphQL(query, queryVariables);
        result = JSON.stringify(response, null, 2);
        status = response.success
          ? "Query executed successfully!"
          : "Query failed!";
      }
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
              onkeydown={(e) => e.key === "Enter" && toggleSection(sectionId)}
              tabindex="0"
              role="button"
            >
              <div class="d-flex align-items-center">
                <i
                  class="bi {activeSection === sectionId
                    ? 'bi-chevron-down'
                    : 'bi-chevron-right'} me-2"
                ></i>
                {#if section.operations.some((op) => op.type === "query")}
                  <span class="badge bg-success me-2">Query</span>
                {/if}
                {#if section.operations.some((op) => op.type === "mutation")}
                  <span class="badge bg-primary me-2">Mutation</span>
                {/if}
                {#if section.operations.some((op) => op.type === "schema")}
                  <span class="badge bg-secondary me-2">SCHEMA</span>
                {/if}
                <strong>{section.name}</strong>
              </div>
            </div>

            {#if activeSection === sectionId}
              <div class="card-body" transition:slide>
                <div class="list-group mb-4">
                  {#each sortOperations(section.operations) as operation, operationIndex}
                    {@const operationId = `${sectionId}-${operationIndex}`}
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
                              ? "Mutation"
                              : operation.type === "query"
                                ? "Query"
                                : "Schema"}
                          </span>
                          <strong>{operation.name}</strong>
                        </div>
                        <div>
                          <button
                            type="button"
                            class="btn btn-outline-{operation.type ===
                            'mutation'
                              ? 'primary'
                              : operation.type === 'query'
                                ? 'success'
                                : 'secondary'} btn-sm"
                            onclick={() => loadQuery(operation, operationId)}
                          >
                            Try it out
                          </button>
                        </div>
                      </div>
                      <div class="mt-2">
                        <small class="text-muted">{operation.description}</small
                        >
                      </div>

                      <!-- Query Editor Section - Only show for the current operation -->
                      {#if currentOperationId === operationId}
                        <div class="card mt-3">
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

                            <!-- Variables Section -->
                            {#if operation.variables}
                              <div class="card mb-3">
                                <div class="card-header bg-light">
                                  <h6 class="card-title mb-0">Variables</h6>
                                </div>
                                <div class="card-body">
                                  <div class="row">
                                    {#each Object.entries(operation.variables) as [varName, description]}
                                      <div class="col-md-6 mb-2">
                                        <div class="input-group">
                                          <span class="input-group-text"
                                            >{varName}</span
                                          >
                                          <input
                                            type="text"
                                            class="form-control"
                                            placeholder={description}
                                            bind:value={variables[varName]}
                                          />
                                        </div>
                                      </div>
                                    {/each}
                                  </div>
                                </div>
                              </div>
                            {/if}

                            <button
                              type="button"
                              class="btn btn-primary"
                              onclick={() => handleExecuteQuery(operation)}
                              disabled={!query}
                            >
                              <i class="bi bi-play-fill me-2"></i>
                              Execute Query
                            </button>

                            {#if status}
                              <div
                                class="alert alert-info mt-3 mb-0"
                                role="alert"
                              >
                                {status}
                              </div>
                            {/if}
                          </div>
                        </div>

                        <!-- Results Section -->
                        <div class="card mt-3">
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
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
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
