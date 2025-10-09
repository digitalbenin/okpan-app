<script>
  import Table from "$lib/components/base/table/Table.svelte";
  import TableImagePreview from "$lib/components/base/table/TableImagePreview.svelte";
  const { data } = $props();

  const items = $derived.by(() => {
    return data.map((item) => ({
      image: $state.snapshot(item.asset),
      fileName: item.asset.filename,
      linkedObjects: item.objects_primary_ids
        ? item.objects_primary_ids.join(", ")
        : "None",
    }));
  });
  // const columns = $derived.by(() => {
  //   const headers = Object.keys(data[0]);
  //   return headers.map((header) => ({
  //     value: header,
  //     label: header,
  //     sortable: false,
  //   }));
  // });

  const columns = $derived.by(() => [
    {
      value: "image",
      label: "Image",
      sortable: false,
      accessor: (value) => {
        const src = value.image.formats.sm;
        const id = value.id;
        return {
          src,
          id,
        };
      },
      render: (value) => ({
        component: TableImagePreview,
        props: value,
      }),
    },
    { value: "fileName", label: "File Name", sortable: false },
    { value: "linkedObjects", label: "Linked Objects", sortable: false },
  ]);
</script>

<Table
  {items}
  {columns}
  selectable={false}
  size="sm"
  bordered={true}
  wrap={true}
/>
