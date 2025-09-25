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
		return ids.map((id) => ({ id, label: `Institution: ${institutionsById.get(id)?.name ?? id}` }));
	});
	const vocabularyChips = $derived.by(() => {
		const chips = [];
		for (const [key, arr] of Object.entries(advancedFilters || {})) {
			if (key === 'institutions' || key === '__textFilters') continue;
			const fieldId = String(key);
			const fieldName = researchFieldById.get(fieldId)?.name ?? 'Field';
			(arr || []).forEach((vocabId) => {
				const vName = vocabById.get(vocabId)?.name ?? vocabId;
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
			let fieldName = 'Field';
			if (tf.kind === 'ontology') fieldName = ontologyFieldById.get(fieldId)?.name ?? fieldName;
			else fieldName = researchFieldById.get(fieldId)?.name ?? fieldName;
			chips.push({ key, kind: tf.kind, fieldId, query: tf.query, label: `${fieldName}: "${tf.query}"` });
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
		runSearch();
	}
	function removeVocabulary(fieldId, vocabId) {
		const arr = advancedFilters[fieldId] || [];
		const idx = arr.indexOf(vocabId);
		if (idx > -1) arr.splice(idx, 1);
		if (arr.length === 0) delete advancedFilters[fieldId];
		runSearch();
	}
	function removeTextFilter(key) {
		const arr = advancedFilters.__textFilters || [];
		const idx = arr.findIndex((tf) => `${tf.kind}:${String(tf.fieldId)}:${tf.query}` === key);
		if (idx > -1) arr.splice(idx, 1);
		if (arr.length === 0) delete advancedFilters.__textFilters;
		runSearch();
	}
	function clearAllAdvancedFilters() {
		advancedFilters = {};
		runSearch();
	}

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
			if (key === 'institutions' || key === '__textFilters') continue;
			if (Array.isArray(value) && value.length > 0) {
				researchFieldFilters.push({ fieldId: key, vocabularyIds: value });
			}
		}

		// Map custom text filters
		const textFieldFilters = [];
		const tfs = advancedFilters.__textFilters || [];
		for (const tf of tfs) {
			if (!tf?.query || !tf?.fieldId) continue;
			if (tf.kind === 'research') {
				// incorporate into researchFieldFilters with query
				researchFieldFilters.push({ fieldId: String(tf.fieldId), query: String(tf.query) });
			} else if (tf.kind === 'ontology') {
				textFieldFilters.push({ kind: 'ontology', fieldId: String(tf.fieldId), query: String(tf.query) });
			}
		}

		if (researchFieldFilters.length > 0) {
			options.researchFieldFilters = researchFieldFilters;
		}
		if (textFieldFilters.length > 0) {
			options.textFieldFilters = textFieldFilters;
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
		<div class="col-10 p-3 border-start min-vh-100">
			<h1>Archive</h1>
			<FilterBar
				value={searchTerm}
				onInput={handleInput}
				{resCount}
				onFiltersClick={handleFiltersClick}
				{institutionChips}
				{vocabularyChips}
				textChips={textChips}
				{hasActiveFilters}
				onRemoveInstitution={removeInstitution}
				onRemoveVocabulary={removeVocabulary}
				onRemoveTextFilter={removeTextFilter}
				onClearAllAdvancedFilters={clearAllAdvancedFilters}
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
