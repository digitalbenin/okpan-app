<script>
  import Table from "$lib/components/base/table/Table.svelte";
  let { data, selected = $bindable() } = $props();

  const columns = $derived.by(() => {
    const headers = Object.keys(data[0]);
    return headers
      .filter((header) => header !== "id")
      .map((header) => {
        if (header === "size") {
          return {
            value: header,
            label: header,
            sortable: false,
            render: (val) => `${val} MB`,
          };
        }
        return {
          value: header,
          label: header,
          sortable: false,
        };
      });
  });
</script>

<Table
  bind:selected
  items={data}
  {columns}
  selectable={true}
  size="sm"
  bordered={true}
  wrap={true}
/>
