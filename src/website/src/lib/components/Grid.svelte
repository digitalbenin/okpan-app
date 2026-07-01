<script>
	import GridCard from '$lib/components/GridCard.svelte';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';

	let { items = [], ontology_fields = [], institutions = [] } = $props();
	const { content } = getWebsiteContentStore();

	const ontologyFieldMap = $derived(
		ontology_fields.reduce((acc, field) => {
			acc[field.id] = field.name;
			return acc;
		}, {})
	);

	const institutionMap = $derived(
		institutions.reduce((acc, inst) => {
			acc[inst.id] = content(inst, 'name');
			return acc;
		}, {})
	);
</script>

<div class="row row-cols-1 row-cols-sm-1 row-cols-md-2 row-cols-lg-3 p-0 g-4">
	{#each items as object (object.id)}
		<div class="col">
			<GridCard {object} {ontologyFieldMap} {institutionMap} />
		</div>
	{/each}
</div>
