<script>
	import ObjectHeader from '$lib/components/ObjectHeader.svelte';
	import ObjectResearchData from '../../lib/components/ObjectResearchData.svelte';

	const { data } = $props();
	const institution = $derived(
		data?.institutions?.find((e) => e.id == data?.object?.institution_id)
	);
	const researchFields = $derived(data.research_fields);
	const objectResearchFields = $derived(data.objectResearchFields);
	const vocabularies = $derived(data.vocabularies);
	const objId = $derived(data?.objectOntologyFields?.find((e) => e.primary)?.value);
</script>

<div class="row p-3 min-vh-100">
	<div class="col-12">
		<ObjectHeader {objId} {institution} />
	</div>
	<div class="row mb-2">
		<div class="col-md-6">images</div>
		<div class="col-md-6">
			<ObjectResearchData {objectResearchFields} {researchFields} {vocabularies} />
		</div>
	</div>
	<div class="row">institution data</div>
</div>
