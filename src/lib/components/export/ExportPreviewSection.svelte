<script>
	import { watch } from 'runed';
	import { searchObjects } from '$lib/api/ObjectsApi.js';
	import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';
	import ConnectionFilters from '$lib/components/export/ConnectionFilters.svelte';
	import InstitutionFilter from '$lib/components/export/InstitutionFilter.svelte';
	import PreviewTable from '$lib/components/export/PreviewTable.svelte';
	import ResearchFieldFilters from '$lib/components/export/ResearchFieldFilters.svelte';
	import StatusFilter from '$lib/components/export/StatusFilter.svelte';
	import {
		buildFiltersPayload,
		buildObjectSearchParams,
		resolveConnectionFieldOptions,
		resolveFreeTextFieldOptions
	} from '$lib/utils/exportFilters.js';

	/**
	 * @typedef {{ institutions: object[], connectionFields: object[], freeTextFields: object[] }} ExportData
	 */

	let {
		projectId,
		/** @type {ExportData} */
		data,
		deselectedObjectIds = $bindable(new Set()),
		totalCount = $bindable(0),
		isLoading = $bindable(false),
		filtersPayload = $bindable({})
	} = $props();

	const { t } = getTranslationStore();

	let selectedStatus = $state('all');
	let selectedInstitutions = $state([]);
	let connectionFilters = $state([]);
	let freeTextFilters = $state([]);
	let currentPage = $state(1);
	const pageSize = 10;
	let objects = $state([]);
	let facets = $state({ institutions: [], statuses: [], researchFields: [] });

	const connectionFieldOptions = $derived(resolveConnectionFieldOptions(data?.connectionFields, t));
	const freeTextFieldOptions = $derived(resolveFreeTextFieldOptions(data?.freeTextFields, t));

	const completedCount = $derived(
		facets.statuses.find((s) => (s.id ?? s.name) === 'completed')?.count ?? 0
	);
	const inProgressCount = $derived(
		facets.statuses.find((s) => (s.id ?? s.name) === 'in progress')?.count ?? 0
	);
	const exportSummary = $derived(t('export.summary', { count: totalCount }));

	function updateFiltersPayload() {
		filtersPayload = buildFiltersPayload({
			projectId,
			selectedStatus,
			selectedInstitutions,
			connectionFilters,
			freeTextFilters,
			connectionFieldOptions
		});
	}

	async function performSearch() {
		updateFiltersPayload();
		isLoading = true;
		try {
			const response = await searchObjects(
				buildObjectSearchParams({
					projectId,
					currentPage,
					pageSize,
					selectedStatus,
					selectedInstitutions,
					connectionFilters,
					freeTextFilters,
					connectionFieldOptions
				})
			);
			if (response.error) {
				objects = [];
				totalCount = 0;
				facets = { institutions: [], statuses: [], researchFields: [] };
			} else {
				objects = response.items ?? [];
				totalCount = response.totalCount ?? 0;
				facets = response.facets ?? { institutions: [], statuses: [], researchFields: [] };
			}
		} catch {
			objects = [];
			totalCount = 0;
			facets = { institutions: [], statuses: [], researchFields: [] };
		} finally {
			isLoading = false;
		}
	}

	function onStatusChanged(newStatus) {
		selectedStatus = newStatus;
		if (currentPage !== 1) { currentPage = 1; return; }
		performSearch();
	}

	function onInstitutionsChanged(newInstitutions) {
		selectedInstitutions = Array.isArray(newInstitutions) ? newInstitutions : [];
		if (currentPage !== 1) { currentPage = 1; return; }
		performSearch();
	}

	function onConnectionFiltersChanged(newFilters) {
		connectionFilters = Array.isArray(newFilters) ? newFilters : [];
		if (currentPage !== 1) { currentPage = 1; return; }
		performSearch();
	}

	function onFreeTextFiltersChanged(newFilters) {
		freeTextFilters = Array.isArray(newFilters) ? newFilters : [];
		if (currentPage !== 1) { currentPage = 1; return; }
		performSearch();
	}

	watch(() => currentPage, () => performSearch(), { immediate: true });
</script>

<StatusFilter
	bind:selectedStatus
	{completedCount}
	{inProgressCount}
	onChange={onStatusChanged}
/>

<InstitutionFilter
	items={data.institutions}
	bind:selectedInstitutions
	onChange={onInstitutionsChanged}
/>

<ConnectionFilters
	{connectionFieldOptions}
	bind:connectionFilters
	onChange={onConnectionFiltersChanged}
/>

<ResearchFieldFilters
	{freeTextFieldOptions}
	bind:freeTextFilters
	onChange={onFreeTextFiltersChanged}
/>

<div class="results-section mt-4 mb-4">
	<div class="summary d-flex align-items-center justify-content-between mb-3">
		<div class="summary-text text-body">{exportSummary}</div>
	</div>

	<PreviewTable
		{objects}
		bind:deselectedObjectIds
		bind:page={currentPage}
		{pageSize}
		count={totalCount}
	/>
</div>
