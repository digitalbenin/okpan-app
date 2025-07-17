<script>
  import ObjectsTableInput from "./ObjectsTableInput.svelte";
  import ObjectsTableInputBatch from "./ObjectsTableInputBatch.svelte";

  let {
    objects,
    columns = [],
    orderBy = $bindable(),
    direction = $bindable(),
    selected = $bindable([]),
    selectable = true,
  } = $props();

  const object_id_accessor = (object) => {
    return (
      object.objectsOntologyFields?.find(
        (f) => f.ontologyField.name.content === "object id"
      )?.value || "Id not set"
    );
  };

  const defaultColumns = [
    {
      value: "object_id",
      label: "Object id",
      accessor: (value) => object_id_accessor(value),
    },
  ];

  const derivedColumns = $derived([...defaultColumns, ...columns]);

  // Helper function to check if render result is a component object
  function isComponentObject(renderResult) {
    return (
      renderResult &&
      typeof renderResult === "object" &&
      renderResult.component &&
      typeof renderResult.component === "function"
    );
  }

  // Helper function to get render result
  function getRenderResult(header, value, object) {
    if (!header.render) return { type: "value", value };

    if (typeof header.render === "function") {
      const result = header.render(value, object);

      if (isComponentObject(result)) {
        return {
          type: "component",
          component: result.component,
          props: result.props || {},
        };
      }

      return { type: "function", value: result };
    }

    return { type: "value", value: header.render };
  }
</script>

<div class="table-responsive">
  <table class="table">
    <thead>
      <tr>
        {#if selectable}
          <th>
            <ObjectsTableInputBatch bind:selected {objects}
            ></ObjectsTableInputBatch>
          </th>
        {/if}
        {#each derivedColumns as header}
          <th class="fs-7 fw-normal text-black-50">
            {#if header.sortable}
              <button
                class="btn btn-link btn-sm p-0 text-black-50 link-underline link-underline-opacity-0"
                onclick={() => {
                  if (orderBy === header.value) {
                    direction = direction === "asc" ? "desc" : "asc";
                  } else {
                    orderBy = header.value;
                    direction = "asc";
                  }
                }}
              >
                {header.label}
                {#if orderBy === header.value}
                  <i
                    class="ms-1 bi bi-caret-{direction === 'asc'
                      ? 'down'
                      : 'up'}-fill"
                  ></i>
                {:else}
                  <i class="ms-1 bi bi-dash"></i>
                {/if}
              </button>
            {:else}
              {header.label}
            {/if}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each objects as object, i (object.id)}
        <tr>
          {#if selectable}
            <th>
              <ObjectsTableInput bind:selected id={object.id}
              ></ObjectsTableInput>
            </th>
          {/if}
          {#each derivedColumns as header, i}
            {@const cellValue = header.accessor
              ? header.accessor(object)
              : object[header.value]}
            {@const {
              type,
              value,
              component: Component,
              props,
            } = getRenderResult(header, cellValue, object)}
            <td>
              {#if type === "component"}
                <Component {...props}></Component>
              {:else if type === "function"}
                {@html value}
              {:else}
                {value || cellValue}
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
