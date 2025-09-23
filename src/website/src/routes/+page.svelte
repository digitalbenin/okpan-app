<script>
	import Grid from '$lib/components/Grid.svelte';
	let { data } = $props();

	$inspect(data);
</script>

{#if data?.searchResult?.items}
	<Grid
		items={data.searchResult.items}
		ontology_fields={data.ontology_fields}
		institutions={data.institutions}
	/>
{/if}
