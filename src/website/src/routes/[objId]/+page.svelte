<script>
	import ObjectHeader from '$lib/components/ObjectHeader.svelte';
	import ObjectResearchData from '$lib/components/ObjectResearchData.svelte';
	import ObjectResearchDataStatic from '$lib/components/ObjectResearchDataStatic.svelte';
	import ObjectInstitutionData from '$lib/components/ObjectInstitutionData.svelte';
	import ObjectImages from '$lib/components/ObjectImages.svelte';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	const { t } = getWebsiteTranslationStore();

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

	const { data } = $props();
	// In static export, institution is passed directly; in preview mode, find it from institutions array
	const institution = $derived(
		data?.institution || data?.institutions?.find((e) => e.id == data?.object?.institution_id)
	);
	const researchFields = $derived(data.research_fields || []);
	const ontologyFields = $derived(data.ontology_fields || []);
	const objectResearchFields = $derived(data.objectResearchFields || []);
	const objectOntologyFields = $derived(data.objectOntologyFields || []);
	const vocabularies = $derived(data.vocabularies || []);
	const datasources = $derived(data.datasources || []);
	const objId = $derived(data?.objectOntologyFields?.find((e) => e.primary)?.value);
	const title = $derived.by(() => {
		const name = (data?.object?.name && String(data.object.name).trim()) || '';
		if (name) return name;
		const primary = data?.objectOntologyFields?.find((e) => e.primary)?.value;
		return primary || t('common.untitled');
	});
	const assets = $derived(data?.assets || []);

	// SEO: Get first asset image for social media preview
	const firstAsset = $derived(assets?.[0]);
	const ogImage = $derived(firstAsset ? getAssetUrl({ asset_path: `project_assets/${data?.object?.project_id}/${firstAsset.asset_path}` }) : null);
	
	// SEO: Build description from object data
	const pageDescription = $derived.by(() => {
		const parts = [];
		if (institution?.name) parts.push(institution.name);
		// Get object type from ontology fields
		const typeField = objectOntologyFields?.find(f => ontologyFields?.find(of => of.id === f.field_id)?.name?.toLowerCase().includes('type'));
		if (typeField?.value) parts.push(typeField.value);
		return parts.length > 0 ? parts.join(t('common.meta-separator')) : t('object.details');
	});
</script>

<svelte:head>
	{#if isStaticExport}
	<!-- Primary Meta Tags -->
	<title>{title}</title>
	<meta name="title" content={title} />
	<meta name="description" content={pageDescription} />
	
	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="article" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={pageDescription} />
	{#if ogImage}
	<meta property="og:image" content={ogImage} />
	{/if}
	
	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={pageDescription} />
	{#if ogImage}
	<meta name="twitter:image" content={ogImage} />
	{/if}
	{/if}
</svelte:head>

<div class="row p-3">
	<div class="col-12">
		<ObjectHeader {title} {institution} projectId={data?.queryParams?.projectId} backHref={data?.queryParams?.backHref} />
	</div>
</div>
<div class="row mb-2">
	<div class="col-md-6">
		<ObjectImages {assets} />
	</div>
	<div class="col-md-6">
		{#if isStaticExport}
			<ObjectResearchDataStatic {objectResearchFields} {researchFields} {vocabularies} />
		{:else}
			<ObjectResearchData {objectResearchFields} {researchFields} {vocabularies} />
		{/if}
	</div>
</div>
<div class="row mt-4">
	<div class="col-md-12">
		<ObjectInstitutionData {objectOntologyFields} {ontologyFields} {datasources} {institution} />
	</div>
</div>
