<script>
	import ObjectHeader from '$lib/components/ObjectHeader.svelte';
	import ObjectResearchData from '$lib/components/ObjectResearchData.svelte';
	import ObjectInstitutionData from '$lib/components/ObjectInstitutionData.svelte';
	import ObjectImages from '$lib/components/ObjectImages.svelte';

	const { data } = $props();
	const institution = $derived(
		data?.institutions?.find((e) => e.id == data?.object?.institution_id)
	);
	const researchFields = $derived(data.research_fields);
	const ontologyFields = $derived(data.ontology_fields);
	const objectResearchFields = $derived(data.objectResearchFields);
	const objectOntologyFields = $derived(data.objectOntologyFields);
	const vocabularies = $derived(data.vocabularies);
	const datasources = $derived(data.datasources);
	const objId = $derived(data?.objectOntologyFields?.find((e) => e.primary)?.value);
	const assets = $derived(data?.assets);
</script>

<div class="row p-3">
	<div class="col-12">
		<ObjectHeader {objId} {institution} />
	</div>
</div>
<div class="row mb-2">
	<div class="col-md-6">
		<ObjectImages {assets} />
	</div>
	<div class="col-md-6">
		<ObjectResearchData {objectResearchFields} {researchFields} {vocabularies} />
	</div>
</div>
<div class="row mt-4">
	<div class="col-md-12">
		<ObjectInstitutionData {objectOntologyFields} {ontologyFields} {datasources} />
	</div>
</div>
