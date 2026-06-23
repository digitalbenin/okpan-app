<script>
  import Table from "$lib/components/base/table/Table.svelte";
  let { data } = $props();

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
  items={data}
  {columns}
  selectable={false}
  size="sm"
  bordered={true}
  wrap={true}
/>
