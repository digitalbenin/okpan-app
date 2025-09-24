<script>
	import Grid from '$lib/components/Grid.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import FilterBar from '$lib/components/Filterbar.svelte';
	import { searchObjects } from '$lib/utils/searchUtils.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let { data } = $props();

	let searchTerm = $state(data.queryParams.q);
	let searchResult = $state(data.searchResult);

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
</script>

<div class="container-fluid">
	<div class="row">
		<div class="col-2 p-3">
			<Sidebar project={data.project} />
		</div>
		<div class="col-10 p-3 border-start">
			<h1>Archive</h1>
			<FilterBar value={searchTerm} onInput={handleInput} />
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
