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
	let advancedFilters = $state(null);
	let searchResult = $state(data.searchResult);
	let resCount = $derived(searchResult?.totalCount || 0);
	let showAdvancedFilters = $state(false);
	let researchFields = data.research_fields;
	let ontologyFields = data.ontology_fields;
	async function handleInput(event) {
		searchTerm = event.target.value;
		const newUrl = new URL($page.url);
		newUrl.searchParams.set('q', searchTerm);
		goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });

		searchResult = await searchObjects({
			...data.queryParams,
			q: searchTerm
		});
	}

	function handleFiltersClick() {
		showAdvancedFilters = true;
	}
</script>

{#if showAdvancedFilters}
	<AdvancedFilters
		{researchFields}
		{ontologyFields}
		{advancedFilters}
		onClose={() => (showAdvancedFilters = false)}
	/>
{/if}

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
