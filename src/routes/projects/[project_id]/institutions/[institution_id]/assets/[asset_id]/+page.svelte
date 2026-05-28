<script>
    import AssetDetailView from "$lib/components/assets/AssetDetailView.svelte";
    const { data } = $props();
</script>

<AssetDetailView {...data} />
