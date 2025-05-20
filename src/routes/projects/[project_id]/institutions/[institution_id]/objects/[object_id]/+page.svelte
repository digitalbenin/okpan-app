<script>
  import ObjectDetail from "$lib/components/objects/ObjectDetail.svelte";
  const { data } = $props();
</script>

<ObjectDetail object={data?.object} />
