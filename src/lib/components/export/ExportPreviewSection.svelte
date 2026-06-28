<script>
	import { watch } from 'runed';
	import { IconFilter, IconX } from '@tabler/icons-svelte';
	import BaseImage from '$lib/components/base/BaseImage.svelte';
	import BasePagination from '$lib/components/base/BasePagination.svelte';
	import ObjectAdvancedFilters from '$lib/components/objects/ObjectAdvancedFilters.svelte';
	import { searchObjects } from '$lib/api/ObjectsApi.js';
	import { getTranslationStore } from '$lib/stores/InterfaceTranslationStore.svelte.js';

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

	// --- Derive data needed by ObjectAdvancedFilters from existing export data ---
	const allResearchFields = $derived([...(data?.connectionFields || []), ...(data?.freeTextFields || [])]);
	const filterInstitutions = $derived(
		(data?.institutions || []).map(inst => ({ id: inst.value, name: inst.label }))
	);
	const vocabularies = $derived(
		(data?.connectionFields || []).flatMap(f =>
			(f.vocabularies || []).map(v => ({ id: v.id, field_id: f.id, name: v.option?.content || v.option || '' }))
		)
	);

	// --- Filter state (same pattern as WebsiteSettings) ---
	let selectedStatus = $state('all');
	let showAdvancedFilters = $state(false);
	let advancedFiltersPanelOpen = $state(false);
	let advancedFilters = $state({});
	let searchResult = $state({ items: [], totalCount: 0, facets: {} });
	let searchLoading = $state(false);
	let currentPage = $state(0); // 0-based for API
	const pageSize = 10;

	const completedCount = $derived(
		(searchResult.facets?.statuses || []).find((s) => (s.id ?? s.name) === 'completed')?.count ?? 0
	);
	const inProgressCount = $derived(
		(searchResult.facets?.statuses || []).find((s) => (s.id ?? s.name) === 'in progress')?.count ?? 0
	);

	const exportedCount = $derived(
		Math.max(0, (searchResult.totalCount ?? 0) - deselectedObjectIds.size)
	);
	const exportSummary = $derived(t('export.summary-count', { count: exportedCount, fallback: 'Your export will include {{count}} objects' }));

	/** @param {object} [advFilters] */
	function buildFiltersPayload(advFilters) {
		advFilters = advFilters || advancedFilters;
		const payload = { project_id: projectId };
		if (selectedStatus !== 'all') payload.status = selectedStatus;
		if (advFilters.institutions?.length) payload.institutionIds = [...advFilters.institutions];

		const researchFieldFilters = [];
		for (const key of Object.keys(advFilters)) {
			if (key.startsWith('__') || key === 'institutions') continue;
			const ids = advFilters[key];
			if (Array.isArray(ids) && ids.length)
				researchFieldFilters.push({ fieldId: key, vocabularyIds: [...ids] });
		}
		if (advFilters.__textFilters?.length) {
			for (const tf of advFilters.__textFilters) {
				if (!tf?.fieldId) continue;
				researchFieldFilters.push({ fieldId: tf.fieldId, query: tf.query || '' });
			}
		}
		if (researchFieldFilters.length) payload.researchFieldFilters = researchFieldFilters;
		if (deselectedObjectIds.size > 0) payload.excludeObjectIds = [...deselectedObjectIds];
		return payload;
	}

	function buildSearchParams() {
		const params = { projectId, page: currentPage, pageSize };
		// Status always applies (not gated behind showAdvancedFilters)
		if (selectedStatus !== 'all') params.status = selectedStatus;
		// Advanced filters only apply when checkbox is checked
		if (showAdvancedFilters) {
			if (advancedFilters.institutions?.length)
				params.institutionIds = [...advancedFilters.institutions];

			const researchFieldFilters = [];
			for (const key of Object.keys(advancedFilters)) {
				if (key.startsWith('__') || key === 'institutions') continue;
				const ids = advancedFilters[key];
				if (Array.isArray(ids) && ids.length)
					researchFieldFilters.push({ fieldId: key, vocabularyIds: [...ids] });
			}
			if (advancedFilters.__textFilters?.length) {
				for (const tf of advancedFilters.__textFilters) {
					if (!tf?.fieldId) continue;
					researchFieldFilters.push({ fieldId: tf.fieldId, query: tf.query || '' });
				}
			}
			if (researchFieldFilters.length) params.researchFieldFilters = researchFieldFilters;
		}
		return params;
	}

	async function doSearch() {
		updateFiltersPayload();
		searchLoading = true;
		try {
			const params = buildSearchParams();
			const response = await searchObjects(params);
			searchResult = response ?? { items: [], totalCount: 0, facets: {} };
			totalCount = searchResult.totalCount ?? 0;
		} catch {
			searchResult = { items: [], totalCount: 0, facets: {} };
			totalCount = 0;
		} finally {
			searchLoading = false;
		}
	}

	function updateFiltersPayload() {
		filtersPayload = buildFiltersPayload();
	}

	function onStatusChange() {
		currentPage = 0;
		doSearch();
	}

	function onFiltersChange(nextFilters) {
		advancedFilters = nextFilters;
		currentPage = 0;
		doSearch();
	}

	function onPageChange(p) {
		currentPage = p - 1; // BasePagination is 1-based
		doSearch();
	}

	function handleAdvancedFiltersChange(checked) {
		showAdvancedFilters = checked;
		if (!checked) {
			advancedFiltersPanelOpen = false;
			advancedFilters = {};
			selectedStatus = 'all';
			deselectedObjectIds = new Set();
			currentPage = 0;
			doSearch();
		}
	}

	function onToggleObjectExclusion(id) {
		const next = new Set(deselectedObjectIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		deselectedObjectIds = next;
	}

	function onToggleAllObjects() {
		const visibleIds = (searchResult.items || []).map(obj => String(obj.id));
		const allChecked = visibleIds.every(id => !deselectedObjectIds.has(id));
		const next = new Set(deselectedObjectIds);
		if (allChecked) {
			visibleIds.forEach(id => next.add(id));
		} else {
			visibleIds.forEach(id => next.delete(id));
		}
		deselectedObjectIds = next;
	}

	function getFirstImageAsset(object) {
		const list = object?.objectsAssets || [];
		const first = list.find((oa) => oa?.asset?.type === 'image') || list[0];
		return first?.asset ?? first ?? null;
	}

	// Initial search on mount once projectId is available
	$effect(() => {
		if (projectId) {
			doSearch();
		}
	});
</script>

<div class="bg-white rounded-3 p-4 mt-3">
	<div class="d-flex flex-column gap-3">
		<p class="mb-0 fw-normal text-body text-uppercase" style="font-size: 12px; letter-spacing: 2px;">
			{t('website-settings.filter-objects', { fallback: 'Filter objects' })}
		</p>

		<!-- Status radio pills -->
		<div class="d-flex flex-column gap-1">
			<p class="fw-semibold mb-1">{t('website-settings.filter-by-status', { fallback: 'Filter objects by status' })}</p>
			<div class="d-flex gap-2">
				{#each [
					{ value: 'all', label: t('filters.all', { fallback: 'All' }), count: completedCount + inProgressCount },
					{ value: 'completed', label: t('common.completed', { fallback: 'Completed' }), count: completedCount },
					{ value: 'in progress', label: t('common.in-progress', { fallback: 'Draft' }), count: inProgressCount }
				] as opt}
					<label class="d-inline-flex align-items-center gap-3 px-3 py-1 border rounded-2 {selectedStatus === opt.value ? 'border-success' : ''} {opt.count === 0 ? 'opacity-50 pe-none' : ''}" style="cursor: pointer;">
						<input
							type="radio"
							class="form-check-input m-0"
							bind:group={selectedStatus}
							value={opt.value}
							disabled={opt.count === 0}
							onchange={onStatusChange}
						/>
						<span class="text-nowrap">{opt.label}</span>
						<span class="badge bg-gray-300 text-body rounded-pill px-2 py-1" style="font-size: 10px;">{opt.count}</span>
					</label>
				{/each}
			</div>
		</div>

		<!-- Advanced filtering checkbox -->
		<div class="form-check">
			<input
				type="checkbox"
				class="form-check-input"
				id="advanced-filtering-check"
				checked={showAdvancedFilters}
				onchange={(e) => handleAdvancedFiltersChange(e.currentTarget.checked)}
			/>
			<label class="form-check-label" for="advanced-filtering-check">
				{t('website-settings.advanced-filtering', { fallback: 'Advanced filtering' })}
			</label>
		</div>

		<!-- Filter button + object list (visible only when checkbox is checked) -->
		{#if showAdvancedFilters}
			<div class="d-flex flex-column gap-3 mt-2">
				<div class="d-flex align-items-center justify-content-between">
					<p class="mb-0 fw-normal text-body text-uppercase" style="font-size: 12px; letter-spacing: 2px;">
						{t('website-settings.preview-objects', { fallback: 'Preview objects on display' })}
					</p>
					<button type="button" class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onclick={() => advancedFiltersPanelOpen = !advancedFiltersPanelOpen}>
						<IconFilter size={14} />
						{t('filters.title', { fallback: 'Filter' })}
					</button>
				</div>

				{#if searchLoading}
					<p class="mb-0 text-body-secondary" style="font-size: 14px;">Loading...</p>
				{:else if searchResult.items?.length > 0}
					<!-- Object preview table -->
					<div class="border rounded-3 overflow-hidden">
						<div class="d-flex gap-2 align-items-center px-2 py-1 bg-white">
							<div style="width: 30px;">
								<input
									type="checkbox"
									class="form-check-input m-0"
									checked={searchResult.items?.length > 0 && searchResult.items.every(obj => !deselectedObjectIds.has(String(obj.id)))}
									onchange={onToggleAllObjects}
								/>
							</div>
							<p class="mb-0 fw-semibold text-body-secondary" style="width: 190px; font-size: 14px;">{t('common.object-id', { fallback: 'Object ID' })}</p>
							<p class="mb-0 fw-semibold text-body-secondary" style="width: 180px; font-size: 14px;">{t('common.status', { fallback: 'Status' })}</p>
							<p class="mb-0 fw-semibold text-body-secondary" style="font-size: 14px;">{t('common.institution', { fallback: 'Institution' })}</p>
						</div>
						{#each searchResult.items as obj, idx}
							<div class="d-flex gap-2 align-items-center px-2 py-1 border-top bg-white" style="min-height: 52px;">
								<div style="width: 30px;">
									<input
										type="checkbox"
										class="form-check-input m-0"
										checked={!deselectedObjectIds.has(String(obj.id))}
										onchange={() => onToggleObjectExclusion(String(obj.id))}
									/>
								</div>
								<div class="flex-shrink-0 rounded overflow-hidden" style="width: 51px; height: 52px;">
									<BaseImage
										asset={getFirstImageAsset(obj)}
										preferredFormat="sm"
										alt=""
										class="w-100 h-100"
										objectFit="cover"
										compact={true}
									/>
								</div>
								<p class="mb-0 fw-semibold text-nowrap" style="width: 139px; font-size: 14px;">{obj?.name || obj?.id || ''}</p>
								<div style="width: 180px;">
									{#if obj?.status === 'completed'}
										<span class="badge bg-success-subtle text-success-emphasis border border-success-subtle rounded-pill px-2 py-1">{t('common.completed', { fallback: 'Complete' })}</span>
									{:else if obj?.status === 'in progress'}
										<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle rounded-pill px-2 py-1">{t('common.in-progress', { fallback: 'Draft' })}</span>
									{:else}
										<span class="badge bg-secondary-subtle text-body-secondary rounded-pill px-2 py-1">{obj?.status || ''}</span>
									{/if}
								</div>
								<p class="mb-0 text-body-secondary text-nowrap" style="font-size: 14px;">{obj?.institution?.name?.content || obj?.institution?.name || ''}</p>
							</div>
						{/each}
					</div>

					<!-- Pagination -->
					{#if searchResult.totalCount > pageSize}
						<BasePagination bind:page={() => currentPage + 1, (p) => onPageChange(p)} {pageSize} count={searchResult.totalCount} size="sm" />
					{/if}
				{:else}
					<p class="mb-0 text-body-secondary" style="font-size: 14px;">
						{t('export.no-objects-match', { fallback: 'No objects match the current filters' })}
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Green objects-exported counter bar (always visible) -->
	<div class="rounded border border-success px-4 py-3 mt-4 mx-0 bg-success-subtle">
		<p class="mb-0 text-black" style="font-size: 14px;">
			{exportSummary}
		</p>
	</div>
</div>

<!-- ObjectAdvancedFilters side panel -->
{#if advancedFiltersPanelOpen}
	<ObjectAdvancedFilters
		researchFields={allResearchFields}
		ontologyFields={[]}
		institutions={filterInstitutions}
		{vocabularies}
		bind:advancedFilters
		facets={searchResult.facets || {}}
		onClose={() => advancedFiltersPanelOpen = false}
		{onFiltersChange}
	/>
{/if}
