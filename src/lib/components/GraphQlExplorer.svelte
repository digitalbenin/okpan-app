<script>
    let query = $state(`{
    project {
      id
      title
      description
    }
  }`);
    let result = $state("");
    let status = $state("");

    const INTROSPECTION_QUERY = `{
      __schema {
        types {
          name
          fields {
            name
            type {
              name
              kind
            }
          }
        }
        mutationType {
          fields {
            name
            args {
              name
              type {
                name
                kind
              }
            }
          }
        }
      }
    }`;

    const ADD_PROJECT_MUTATION = `mutation {
    insertIntoProject(values: [{
      title: "Project ${Math.random().toString(36).substring(7)}",
      description: "Description of the project"
    }]) {
      id
      title
      description
    }
  }`;

    const LIST_PROJECTS_QUERY = `{
    project {
      id
      title
      description
    }
  }`;

    const handleExecuteQuery = async () => {
        try {
            status = "Executing query...";
            const response = await window.api.executeGraphQL(query);
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
        query = queryText;
    };
</script>

<div class="card">
    <div class="card-body">
        <h5 class="card-title mb-3">GraphQL Explorer</h5>

        <div class="mb-3">
            <label for="queryEditor" class="form-label">Query</label>
            <div class="mb-2 d-flex gap-2">
                <button
                    type="button"
                    class="btn btn-outline-primary btn-sm"
                    onclick={() =>
                        loadQuery(ADD_PROJECT_MUTATION, "Add project")}
                >
                    <i class="bi bi-plus-circle me-2"></i>
                    Add Project
                </button>
                <button
                    type="button"
                    class="btn btn-outline-success btn-sm"
                    onclick={() =>
                        loadQuery(LIST_PROJECTS_QUERY, "List projects")}
                >
                    <i class="bi bi-list me-2"></i>
                    List Projects
                </button>
                <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm"
                    onclick={() => loadQuery(INTROSPECTION_QUERY, "Schema")}
                >
                    <i class="bi bi-code-square me-2"></i>
                    Show Schema
                </button>
            </div>
            <textarea
                id="queryEditor"
                class="form-control font-monospace"
                rows="8"
                bind:value={query}
                placeholder="Enter your GraphQL query here..."
            ></textarea>
        </div>

        <div class="mb-3">
            <button
                type="button"
                class="btn btn-primary"
                onclick={handleExecuteQuery}
            >
                <i class="bi bi-play-fill me-2"></i>
                Execute Query
            </button>
        </div>

        {#if status}
            <div class="alert alert-info mb-3" role="alert">
                {status}
            </div>
        {/if}

        <div class="mb-3">
            <label for="resultViewer" class="form-label">Result</label>
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

<style>
    textarea {
        white-space: pre;
        overflow-wrap: normal;
        overflow-x: scroll;
    }
</style>
