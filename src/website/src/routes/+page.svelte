<script>
	import { onMount } from 'svelte';
	import Grid from '$lib/components/Grid.svelte';

	import Pagination from '$lib/components/Pagination.svelte';
	import SearchBar from '$lib/components/SearchBar.svelte';
	import AdvancedFiltersPanel from '$lib/components/AdvancedFiltersPanel.svelte';
	import Header from '$lib/components/Header.svelte';
	import { searchObjects } from '$lib/utils/search.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { resolveSitePath } from '$lib/utils/sitePaths.js';
	import { IconFilter } from "@tabler/icons-svelte"
	import { queryParameters, ssp } from "sveltekit-search-params";
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

function getFilterChipLabel(item) {
	return content(item, 'name') || '';
}

const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

	let { data } = $props();

	// Derive local project/settings from data (these don't exist in page scope otherwise)
	const project = $derived(data?.project || {});
	const settings = $derived(data?.settings || {});

	// SEO data
	const siteTitle = $derived(content(data?.settings, 'title') || content(data?.project, 'name') || t('site.default-title'));
	const siteDescription = $derived(content(data?.settings, 'short_description') || content(data?.project, 'description') || t('site.default-description'));
	const siteLogo = $derived(data?.settings?.logo_asset_path ? getAssetUrl({ asset_path: data.settings.logo_asset_path }) : null);

	// URL search params — single source of truth
	const params = queryParameters({
		q: ssp.string(''),
		page: ssp.number(1),
		pageSize: ssp.number(15),
		filters: ssp.object({}),
	}, {
		debounceHistory: 300,
	});

	const searchTerm = $derived(params.q);
	const currentPage = $derived(params.page);
	const pageSize = $derived(params.pageSize);
	let advancedFilters = $state($state.snapshot(params.filters));
	let searchResult = $state(data.searchResult);
	const pageCount = $derived.by(() => {
		const total = searchResult?.totalCount || 0;
		return Math.max(1, Math.ceil(total / (pageSize || 1)));
	});
	let showAdvancedFilters = $state(false);

	// Sync advancedFilters from URL when it changes externally (back/forward)
	$effect(() => {
		const urlFilters = params.filters;
		const localSnapshot = $state.snapshot(advancedFilters);
		if (JSON.stringify(urlFilters) !== JSON.stringify(localSnapshot)) {
			advancedFilters = $state.snapshot(urlFilters);
			runSearch();
		}
	});
	
	// Reference data — reactive to layout data changes, overrideable by static export
	let staticResearchFields = $state(null);
	let staticOntologyFields = $state(null);
	let staticInstitutions = $state(null);
	let staticVocabularies = $state(null);
	const researchFields = $derived.by(() => staticResearchFields || data?.research_fields || []);
	const ontologyFields = $derived.by(() => staticOntologyFields || data?.ontology_fields || []);
	const institutions = $derived.by(() => staticInstitutions || data?.institutions || []);
	const vocabularies = $derived.by(() => staticVocabularies || data?.vocabularies || []);
	
	// Loading state for static export
	let isLoading = $state(isStaticExport && data.needsClientLoad);

	// Static export: load data.json client-side on mount
	onMount(async () => {
		if (isStaticExport && data.needsClientLoad) {
			try {
				const response = await fetch(resolveSitePath('data.json'));
				const jsonData = await response.json();
				
				// Store reference data via static overrides (so $derived picks them up)
				staticResearchFields = jsonData.research_fields || [];
				staticOntologyFields = jsonData.ontology_fields || [];
				staticInstitutions = jsonData.institutions || [];
				staticVocabularies = jsonData.vocabularies || [];
				
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
		params.q = event.target.value;
		params.page = 1;
		await runSearch();
	}

	function onPageChange(nextPage) {
		if (!Number.isFinite(nextPage)) return;
		if (nextPage < 1) return;
		if (nextPage > pageCount) return;
		params.page = nextPage;
		runSearch();
	}

	// Fast lookup maps for chips
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

	// Chip derivations
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
	const hasActiveFilters = $derived(
		(institutionChips?.length || 0) + (vocabularyChips?.length || 0) > 0
	);

	function syncFiltersToUrl() {
		params.filters = $state.snapshot(advancedFilters);
		params.page = 1;
	}

	function removeInstitution(id) {
		const arr = advancedFilters.institutions || [];
		const idx = arr.indexOf(id);
		if (idx > -1) arr.splice(idx, 1);
		if (arr.length === 0) delete advancedFilters.institutions;
		syncFiltersToUrl();
		runSearch();
	}
	function removeVocabulary(fieldId, vocabId) {
		const arr = advancedFilters[fieldId] || [];
		const idx = arr.indexOf(vocabId);
		if (idx > -1) arr.splice(idx, 1);
		if (arr.length === 0) delete advancedFilters[fieldId];
		syncFiltersToUrl();
		runSearch();
	}

	function handleFiltersClick() {
		showAdvancedFilters = true;
	}

	function onFiltersChange() {
		syncFiltersToUrl();
		runSearch();
	}

	function closeAdvancedFilters() {
		showAdvancedFilters = false;
	}
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

<Header {project} {settings} activeProjectId={data?.activeProjectId} />

<div class="container-xl mt-4 d-flex flex-column gap-2">

<SearchBar search={searchTerm} oninput={handleInput} placeholder={t('filters.search-placeholder')}>
	{#snippet children()}
		<button class="btn btn-dark d-flex align-items-center gap-1 ps-3" onclick={handleFiltersClick}>
			<IconFilter size={16} class="me-2 ms-0" />
			{t('filters.title')}
		</button>
	{/snippet}
</SearchBar>

{#if hasActiveFilters}
	<div class="d-flex align-items-center gap-3 pt-3">
		<span class="fw-bold text-nowrap">{searchResult?.totalCount || 0} {t('common.objects', { fallback: 'objects' })}</span>
		<div class="d-flex gap-2 flex-wrap">
			{#each institutionChips as chip (chip.id)}
				<button
					class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
					onclick={() => removeInstitution(chip.id)}
				>
					{chip.label}
					<i class="bi bi-x"></i>
				</button>
			{/each}
			{#each vocabularyChips as chip (chip.vocabId)}
				<button
					class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
					onclick={() => removeVocabulary(chip.fieldId, chip.vocabId)}
				>
					{chip.label}
					<i class="bi bi-x"></i>
				</button>
			{/each}
		</div>
	</div>
{:else}
	<div class="pt-3">
		<span class="fw-bold">{searchResult?.totalCount || 0} {t('common.objects', { fallback: 'objects' })}</span>
	</div>
{/if}

<div class="row">
	<div class="col-12 py-4 overflow-hidden ">
		{#if isLoading}
			<div class="text-center py-5">
				<div class="spinner-border" role="status">
					<span class="visually-hidden">{t('common.loading')}</span>
				</div>
				<p class="mt-2">{t('page.archive.loading')}</p>
			</div>
		{:else}
			<Grid
				items={searchResult?.items || []}
				ontology_fields={ontologyFields}
				{institutions}
			/>
			{#if pageCount > 1}
				<div class="my-4">
					<Pagination page={currentPage} {pageCount} {onPageChange} size="sm" />
				</div>
			{/if}
		{/if}
	</div>
</div>
</div>

{#if showAdvancedFilters}
	<AdvancedFiltersPanel
		{researchFields}
		{ontologyFields}
		{institutions}
		{vocabularies}
		bind:advancedFilters
		facets={searchResult?.facets}
		onClose={closeAdvancedFilters}
		{onFiltersChange}
	/>
{/if}
