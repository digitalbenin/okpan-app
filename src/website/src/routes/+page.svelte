<script>
	import { onMount } from 'svelte';
	import Grid from '$lib/components/Grid.svelte';

	import FilterBar from '$lib/components/Filterbar.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import AdvancedFilters from '$lib/components/AdvancedFilters.svelte';
	import { searchObjects } from '$lib/utils/search.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	import { page } from '$app/stores';
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { resolveSitePath } from '$lib/utils/sitePaths.js';
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

	let { data } = $props();

	// SEO data
	const siteTitle = $derived(content(data?.settings, 'title') || content(data?.project, 'name') || t('site.default-title'));
	const siteDescription = $derived(content(data?.settings, 'description') || content(data?.project, 'description') || t('site.default-description'));
	const siteLogo = $derived(data?.settings?.logo_asset_path ? getAssetUrl({ asset_path: data.settings.logo_asset_path }) : null);

	let searchTerm = $state(data.queryParams.q);
	let advancedFilters = $state({});
	let searchResult = $state(data.searchResult);
	let resCount = $derived(searchResult?.totalCount || 0);
	let currentPage = $state(data.queryParams.page || 1);
	let pageSize = $state(data.queryParams.pageSize || (data.searchResult?.pageSize ?? 25));
	const pageCount = $derived.by(() => {
		const total = searchResult?.totalCount || 0;
		return Math.max(1, Math.ceil(total / (pageSize || 1)));
	});
	let showAdvancedFilters = $state(false);
	
	// Reference data - will be loaded client-side in static export mode
	let researchFields = $state(data.research_fields || []);
	let ontologyFields = $state(data.ontology_fields || []);
	let institutions = $state(data.institutions || []);
	let vocabularies = $state(data.vocabularies || []);
	
	// Loading state for static export
	let isLoading = $state(isStaticExport && data.needsClientLoad);

	// Static export: load data.json client-side on mount
	onMount(async () => {
		if (isStaticExport && data.needsClientLoad) {
			try {
				const response = await fetch(resolveSitePath('data.json'));
				const jsonData = await response.json();
				
				// Store reference data
				researchFields = jsonData.research_fields || [];
				ontologyFields = jsonData.ontology_fields || [];
				institutions = jsonData.institutions || [];
				vocabularies = jsonData.vocabularies || [];
				
				// Update SEO data from loaded data
				if (jsonData.settings) data.settings = jsonData.settings;
				if (jsonData.project) data.project = jsonData.project;
				
				// Run initial search
				isLoading = false;
				await runSearch();
			} catch (error) {
				console.error('[Homepage] Failed to load data.json:', error);
				isLoading = false;
			}
		}
	});

	// Fast lookup maps
	const institutionsById = $derived.by(() => {
		const m = new Map();
		(institutions || []).forEach((i) => m.set(i.id, i));
		return m;
	});
	const vocabById = $derived.by(() => {
		const m = new Map();
		(vocabularies || []).forEach((v) => m.set(v.id, v));
		return m;
	});
	const researchFieldById = $derived.by(() => {
		const m = new Map();
		(researchFields || []).forEach((f) => m.set(String(f.id), f));
		return m;
	});
	const ontologyFieldById = $derived.by(() => {
		const m = new Map();
		(ontologyFields || []).forEach((f) => m.set(String(f.id), f));
		return m;
	});

	// Build badge models for active filters
	const institutionChips = $derived.by(() => {
		const ids = advancedFilters?.institutions || [];
		return ids.map((id) => ({
			id,
			label: t('filters.institution-chip', { name: content(institutionsById.get(id), 'name', id) }),
		}));
	});
	const vocabularyChips = $derived.by(() => {
		const chips = [];
		for (const [key, arr] of Object.entries(advancedFilters || {})) {
			if (key === 'institutions' || key === '__textFilters') continue;
			const fieldId = String(key);
			const fieldName = content(researchFieldById.get(fieldId), 'name') || t('filters.field-fallback');
			(arr || []).forEach((vocabId) => {
				const vName = content(vocabById.get(vocabId), 'name', vocabId);
				chips.push({ fieldId, vocabId, label: `${fieldName}: ${vName}` });
			});
		}
		return chips;
	});
	const textChips = $derived.by(() => {
		const chips = [];
		const arr = advancedFilters?.__textFilters || [];
		for (const tf of arr) {
			if (!tf) continue;
			const fieldId = String(tf.fieldId);
			const key = `${tf.kind}:${fieldId}:${tf.query}`;
			let fieldName = t('filters.field-fallback');
			if (tf.kind === 'ontology') fieldName = content(ontologyFieldById.get(fieldId), 'name') || fieldName;
			else fieldName = content(researchFieldById.get(fieldId), 'name') || fieldName;
			chips.push({
				key,
				kind: tf.kind,
				fieldId,
				query: tf.query,
				label: `${fieldName}: "${tf.query}"`
			});
		}
		return chips;
	});
	const hasActiveFilters = $derived(
		(institutionChips?.length || 0) + (vocabularyChips?.length || 0) + (textChips?.length || 0) > 0
	);

	function removeInstitution(id) {
		const arr = advancedFilters.institutions || [];
		const idx = arr.indexOf(id);
		if (idx > -1) arr.splice(idx, 1);
		if (arr.length === 0) delete advancedFilters.institutions;
		currentPage = 1;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('page', String(currentPage));
		history.replaceState(null, '', newUrl);
		runSearch();
	}
	function removeVocabulary(fieldId, vocabId) {
		const arr = advancedFilters[fieldId] || [];
		const idx = arr.indexOf(vocabId);
		if (idx > -1) arr.splice(idx, 1);
		if (arr.length === 0) delete advancedFilters[fieldId];
		currentPage = 1;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('page', String(currentPage));
		history.replaceState(null, '', newUrl);
		runSearch();
	}
	function removeTextFilter(key) {
		const arr = advancedFilters.__textFilters || [];
		const idx = arr.findIndex((tf) => `${tf.kind}:${String(tf.fieldId)}:${tf.query}` === key);
		if (idx > -1) arr.splice(idx, 1);
		if (arr.length === 0) delete advancedFilters.__textFilters;
		currentPage = 1;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('page', String(currentPage));
		history.replaceState(null, '', newUrl);
		runSearch();
	}
	function clearAllAdvancedFilters() {
		advancedFilters = {};
		currentPage = 1;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('page', String(currentPage));
		history.replaceState(null, '', newUrl);
		runSearch();
	}

	function buildSearchOptions() {
		// Base options mapped to searchUtils expectations (snake_case where required)
		const qp = data.queryParams || {};
		const storedFilters = data.settings?.filters || {};
		const options = {
			q: (searchTerm ?? '').trim(),
			project_id: qp.projectId || null,
			page: currentPage,
			pageSize: pageSize,
			orderBy: qp.orderBy,
			direction: qp.direction // 'asc' | 'desc'
		};

		// Status from stored filters (corpus definition) — always applied in preview mode
		if (!isStaticExport && storedFilters.status && storedFilters.status !== 'all') {
			options.status = storedFilters.status;
		}

		// Institutions: corpus filter defines the base set; user filter narrows within it
		const corpusInstitutionIds = !isStaticExport && storedFilters.institutionIds?.length ? storedFilters.institutionIds : null;
		const userInstitutionIds = advancedFilters?.institutions?.length ? advancedFilters.institutions : null;

		if (corpusInstitutionIds && userInstitutionIds) {
			options.institution_ids = userInstitutionIds.filter(id => corpusInstitutionIds.includes(id));
		} else if (corpusInstitutionIds) {
			options.institution_ids = corpusInstitutionIds;
		} else if (userInstitutionIds) {
			options.institution_ids = userInstitutionIds;
		}

		if (corpusInstitutionIds) {
			options.corpus_institution_ids = corpusInstitutionIds;
		}

		// Research field vocabulary selections mapping -> researchFieldFilters
		const userResearchFieldFilters = [];
		for (const [key, value] of Object.entries(advancedFilters || {})) {
			if (key === 'institutions' || key === '__textFilters') continue;
			if (Array.isArray(value) && value.length > 0) {
				userResearchFieldFilters.push({ fieldId: key, vocabularyIds: value });
			}
		}

		// Map custom text filters
		const textFieldFilters = [];
		const tfs = advancedFilters.__textFilters || [];
		for (const tf of tfs) {
			if (!tf?.query || !tf?.fieldId) continue;
			if (tf.kind === 'research') {
				// incorporate into userResearchFieldFilters with query
				userResearchFieldFilters.push({ fieldId: String(tf.fieldId), query: String(tf.query) });
			} else if (tf.kind === 'ontology') {
				textFieldFilters.push({
					kind: 'ontology',
					fieldId: String(tf.fieldId),
					query: String(tf.query)
				});
			}
		}

		const corpusResearchFieldFilters = !isStaticExport && storedFilters.researchFieldFilters || [];
		const combinedResearchFieldFilters = [...corpusResearchFieldFilters, ...userResearchFieldFilters];

		if (combinedResearchFieldFilters.length > 0) {
			options.researchFieldFilters = combinedResearchFieldFilters;
		}
		if (corpusResearchFieldFilters.length > 0) {
			options.corpus_researchFieldFilters = corpusResearchFieldFilters;
		}
		if (textFieldFilters.length > 0) {
			options.textFieldFilters = textFieldFilters;
		}

		if (!isStaticExport && storedFilters.excludeObjectIds?.length) {
			options.excluded_object_ids = storedFilters.excludeObjectIds;
		}

		return options;
	}

	async function runSearch() {
		const options = buildSearchOptions();
		searchResult = await searchObjects(options);
	}

	async function handleInput(event) {
		searchTerm = event.target.value;
		currentPage = 1; // reset to first page on new search
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('q', searchTerm);
		newUrl.searchParams.set('page', String(currentPage));
		history.replaceState(null, '', newUrl);
		await runSearch();
	}

	function onPageChange(nextPage) {
		if (!Number.isFinite(nextPage)) return;
		if (nextPage < 1) return;
		if (nextPage > pageCount) return;
		currentPage = nextPage;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('page', String(currentPage));
		history.replaceState(null, '', newUrl);
		runSearch();
	}

	function handleFiltersClick() {
		showAdvancedFilters = true;
	}

	function onFiltersChange() {
		currentPage = 1;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('page', String(currentPage));
		history.replaceState(null, '', newUrl);
		runSearch();
	}

	function closeAdvancedFilters() {
		showAdvancedFilters = false;
	}

	$inspect(data);
</script>

<svelte:head>
	{#if isStaticExport}
	<!-- Primary Meta Tags -->
	<title>{siteTitle}</title>
	<meta name="title" content={siteTitle} />
	<meta name="description" content={siteDescription} />
	
	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={siteTitle} />
	<meta property="og:description" content={siteDescription} />
	{#if siteLogo}
	<meta property="og:image" content={siteLogo} />
	{/if}
	
	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={siteTitle} />
	<meta name="twitter:description" content={siteDescription} />
	{#if siteLogo}
	<meta name="twitter:image" content={siteLogo} />
	{/if}
	{/if}
</svelte:head>

<div class="row">
	<div class="col-12 p-3 min-vh-100 overflow-y-hidden">
		<h1>{t('nav.archive')}</h1>
		{#if isLoading}
			<div class="text-center py-5">
				<div class="spinner-border" role="status">
					<span class="visually-hidden">{t('common.loading')}</span>
				</div>
				<p class="mt-2">{t('page.archive.loading')}</p>
			</div>
		{:else}
			<FilterBar
				value={searchTerm}
				onInput={handleInput}
				{resCount}
				onFiltersClick={handleFiltersClick}
				{institutionChips}
				{vocabularyChips}
				{textChips}
				{hasActiveFilters}
				onRemoveInstitution={removeInstitution}
				onRemoveVocabulary={removeVocabulary}
				onRemoveTextFilter={removeTextFilter}
				onClearAllAdvancedFilters={clearAllAdvancedFilters}
			/>

			<Grid
				items={searchResult?.items || []}
				ontology_fields={ontologyFields}
				{institutions}
			/>
			{#if pageCount > 1}
				<div class="mt-3">
					<Pagination page={currentPage} {pageCount} {onPageChange} size="sm" />
				</div>
			{/if}
		{/if}
	</div>
</div>

{#if showAdvancedFilters}
	<AdvancedFilters
		{researchFields}
		{ontologyFields}
		{institutions}
		{vocabularies}
		{advancedFilters}
		facets={searchResult?.facets}
		onClose={closeAdvancedFilters}
		{onFiltersChange}
	/>
{/if}
