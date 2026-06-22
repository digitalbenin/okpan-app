<script>
  import Table from "$lib/components/base/table/Table.svelte";
  const { data } = $props();

  const columns = $derived.by(() => {
    const headers = Object.keys(data[0]);
    return headers.map((header) => ({
      value: header,
      label: header,
      sortable: false,
    }));
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
