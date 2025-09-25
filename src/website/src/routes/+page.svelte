<script>
	import Grid from '$lib/components/Grid.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import FilterBar from '$lib/components/Filterbar.svelte';
	import AdvancedFilters from '$lib/components/AdvancedFilters.svelte';
	import { searchObjects } from '$lib/utils/searchUtils.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let searchTerm = $state(data.queryParams.q);
	let advancedFilters = $state({});
	let searchResult = $state(data.searchResult);
	let resCount = $derived(searchResult?.totalCount || 0);
	let showAdvancedFilters = $state(false);
	let researchFields = data.research_fields;
	let ontologyFields = data.ontology_fields;
	let institutions = data.institutions;
	let vocabularies = data.vocabularies;

	function buildSearchOptions() {
		// Base options mapped to searchUtils expectations (snake_case where required)
		const qp = data.queryParams || {};
		const options = {
			q: (searchTerm ?? '').trim(),
			project_id: qp.projectId || null,
			page: qp.page,
			limit: qp.pageSize,
			orderBy: qp.orderBy,
			direction: qp.direction // 'asc' | 'desc'
		};

		// Institutions from advanced filters
		if (advancedFilters?.institutions?.length) {
			options.institution_ids = advancedFilters.institutions;
		}

		// Research field vocabulary selections mapping -> researchFieldFilters
		const researchFieldFilters = [];
		for (const [key, value] of Object.entries(advancedFilters || {})) {
			if (key === 'institutions') continue;
			if (Array.isArray(value) && value.length > 0) {
				researchFieldFilters.push({ fieldId: key, vocabularyIds: value });
			}
		}
		if (researchFieldFilters.length > 0) {
			options.researchFieldFilters = researchFieldFilters;
		}

		return options;
	}

	async function runSearch() {
		const options = buildSearchOptions();
		console.log('[runSearch options]', options);
		searchResult = await searchObjects(options);
	}

	async function handleInput(event) {
		searchTerm = event.target.value;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('q', searchTerm);
		goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });
		await runSearch();
	}

	function handleFiltersClick() {
		showAdvancedFilters = true;
	}

	function onFiltersChange() {
		runSearch();
	}

	function closeAdvancedFilters() {
		showAdvancedFilters = false;
	}

	$inspect(data);
</script>

<div class="container-fluid">
	<div class="row">
		<div class="col-2 p-3">
			<Sidebar project={data.project} />
		</div>
		<div class="col-10 p-3 border-start">
			<h1>Archive</h1>
			<FilterBar
				value={searchTerm}
				onInput={handleInput}
				{resCount}
				onFiltersClick={handleFiltersClick}
			/>
			{#if searchResult?.items}
				<Grid
					items={searchResult.items}
					ontology_fields={data.ontology_fields}
					institutions={data.institutions}
				/>
			{/if}
		</div>
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
