<script>
	import GridCard from '$lib/components/GridCard.svelte';

	let { items = [], ontology_fields = [], institutions = [] } = $props();

	const ontologyFieldMap = $derived(
		ontology_fields.reduce((acc, field) => {
			acc[field.id] = field.name;
			return acc;
		}, {})
	);

	const institutionMap = $derived(
		institutions.reduce((acc, inst) => {
			acc[inst.id] = inst.name;
			return acc;
		}, {})
	);
</script>

<div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4">
	{#each items as object (object.id)}
		<div class="col">
			<GridCard {object} {ontologyFieldMap} {institutionMap} />
		</div>
	{/each}
</div>
