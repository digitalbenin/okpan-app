<script>
  import ObjectDetailView from "$lib/components/objects/ObjectDetailView.svelte";

  const { data } = $props();
</script>

<ObjectDetailView {...data} />
