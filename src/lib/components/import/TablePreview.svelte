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
  size="lg"
  bordered={true}
  headerClass="fs-7 fw-bold"
  wrap={true}
  cellClass="align-top"
  cellContentStyle="display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;"
/>
