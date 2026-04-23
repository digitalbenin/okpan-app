<script>
	import { fly, fade } from 'svelte/transition';
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	let {
		advancedFilters,
		onFiltersChange,
		onClose,
		researchFields = [],
		institutions = [],
		vocabularies = [],
		facets,
		ontologyFields = []
	} = $props();

	let activeView = $state('main');
	let selectedField = $state(null);
	let searchTerm = $state('');
	let openInfoId = $state(null); // which vocabulary item has its info panel open

	// State for "Add search field" view
	let textSelectedFieldId = $state(''); // encoded kind:id (e.g., "o:12" or "r:34")
	let textQuery = $state('');

	// Build fast lookup maps for facet counts
	let institutionFacetMap = $derived.by(() => {
		const map = new Map();
		const list = facets?.institution_ids || [];
		for (const row of list) {
			const id = row.institution_id ?? row.id;
			const count = row.count;
			map.set(id, Number(count) || 0);
		}
		return map;
	});

	let researchFacetMap = $derived.by(() => {
		const map = new Map();
		const list = facets?.research_fields || [];
		for (const row of list) {
			const count = row.count;
			map.set(`${row.field_id}:${row.vocabulary_id}`, Number(count) || 0);
		}
		return map;
	});

	function showDetail(field) {
		selectedField = field;
		activeView = 'detail';
		openInfoId = null; // close any open info when switching view
	}

	function showAddTextSearch(prefillKey = '', prefillQuery = '') {
		activeView = 'addText';
		textSelectedFieldId = prefillKey;
		textQuery = prefillQuery;
	}

	function toggleFilter(itemId) {
		const fieldKey = selectedField.type === 'institutions' ? 'institutions' : selectedField.id;
		if (!advancedFilters[fieldKey]) {
			advancedFilters[fieldKey] = [];
		}

		const index = advancedFilters[fieldKey].indexOf(itemId);
		if (index > -1) {
			advancedFilters[fieldKey].splice(index, 1);
		} else {
			advancedFilters[fieldKey].push(itemId);
		}
		onFiltersChange(advancedFilters);
	}

	function resetFilter() {
		if (!selectedField) return;
		const fieldKey = selectedField.type === 'institutions' ? 'institutions' : selectedField.id;
		advancedFilters[fieldKey] = [];
		onFiltersChange(advancedFilters);
	}

	function isSelected(itemId) {
		const fieldKey = selectedField.type === 'institutions' ? 'institutions' : selectedField.id;
		return advancedFilters[fieldKey] && advancedFilters[fieldKey].includes(itemId);
	}

	function showMain() {
		activeView = 'main';
		searchTerm = '';
		openInfoId = null; // close info panels when going back
	}

	function getFacetCountForItem(item) {
		if (!selectedField) return 0;
		if (selectedField.type === 'institutions') {
			return institutionFacetMap.get(item.id) ?? 0;
		}
		if (selectedField.type === 'vocabulary') {
			return researchFacetMap.get(`${selectedField.id}:${item.id}`) ?? 0;
		}
		return 0;
	}

	function toggleInfo(item) {
		openInfoId = openInfoId === item.id ? null : item.id;
	}

	// Compute filtered items reactively without $effect
	let filteredItems = $derived.by(() => {
		if (activeView !== 'detail' || !selectedField) return [];
		let items = [];
		if (selectedField.type === 'institutions') {
			items = institutions;
		} else if (selectedField.type === 'vocabulary') {
			items = vocabularies.filter((v) => v.field_id === selectedField.id);
		}

		const term = (searchTerm || '').toLowerCase().trim();
		let result = items;
		if (term) {
			result = items.filter((item) => (content(item, 'name') || '').toLowerCase().includes(term));
		}

		// Sort by facet count descending; tiebreaker by name ascending
		result = [...result].sort((a, b) => {
			const countB = getFacetCountForItem(b);
			const countA = getFacetCountForItem(a);
			if (countB !== countA) return countB - countA;
			const nameA = (content(a, 'name') || '').toLowerCase();
			const nameB = (content(b, 'name') || '').toLowerCase();
			return nameA.localeCompare(nameB);
		});

		return result;
	});

	// Divide research fields into connections (vocabulary) and free-text
	let connectionResearchFields = $derived.by(() =>
		(researchFields || []).filter((f) => f.type === 'vocabulary')
	);
	let textResearchFields = $derived.by(() =>
		(researchFields || []).filter((f) => f.type !== 'vocabulary')
	);

	function getCurrentTextQuery(kind, fieldId) {
		const tf = (advancedFilters?.__textFilters ?? []).find(
			(x) => x.kind === kind && String(x.fieldId) === String(fieldId)
		);
		return tf?.query?.trim() || '';
	}

	function getConnectionSelectionLabel(field) {
		const selected = advancedFilters?.[field.id];
		if (!selected || !selected.length) return t('filters.all');
		const names = vocabularies
			.filter((v) => v.field_id === field.id && selected.includes(v.id))
			.map((v) => content(v, 'name') || '')
			.filter(Boolean);
		return names.length ? names.join(t('common.list-separator')) : t('filters.all');
	}

	// Selectable fields for the "Add search field" UI
	let selectableTextFields = $derived.by(() => {
		const list = [];
		// All ontology fields
		(ontologyFields || []).forEach((f) =>
			list.push({ key: `o:${f.id}`, label: content(f, 'name'), kind: 'ontology', id: f.id })
		);
		// All research fields that are NOT vocabulary-based (freetext)
		(researchFields || [])
			.filter((f) => f.type !== 'vocabulary')
			.forEach((f) => list.push({ key: `r:${f.id}`, label: content(f, 'name'), kind: 'research', id: f.id }));
		// Sort alphabetically
		return list.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
	});

	function ensureTextFiltersArray() {
		if (!advancedFilters.__textFilters) advancedFilters.__textFilters = [];
		return advancedFilters.__textFilters;
	}

	function parseKind(val) {
		const [k, id] = (val || '').split(':');
		if (k === 'o') return { kind: 'ontology', id };
		if (k === 'r') return { kind: 'research', id };
		return { kind: null, id: null };
	}

	function upsertOrRemoveTextFilter() {
		const val = (textSelectedFieldId || '').trim();
		const q = (textQuery || '').trim();
		const { kind, id } = parseKind(val);
		if (!kind || !id) return; // no field selected yet

		const arr = ensureTextFiltersArray();
		const idx = arr.findIndex((tf) => tf.kind === kind && String(tf.fieldId) === String(id));

		if (!q) {
			// remove existing filter for this field if the query is empty
			if (idx > -1) arr.splice(idx, 1);
		} else {
			const next = { kind, fieldId: id, query: q };
			if (idx > -1) arr[idx] = next;
			else arr.push(next);
		}
		onFiltersChange(advancedFilters);
	}

	function onTextFieldChange() {
		upsertOrRemoveTextFilter();
	}
	function onTextQueryInput() {
		upsertOrRemoveTextFilter();
	}

	// Active text filters list and helpers
	let currentTextFilters = $derived.by(() => advancedFilters?.__textFilters ?? []);
	function textFilterKey(tf) {
		return `${tf.kind}:${tf.fieldId}`;
	}
	function getTextFieldLabel(tf) {
		if (tf?.kind === 'ontology') {
			const f = (ontologyFields || []).find((o) => String(o.id) === String(tf.fieldId));
			return content(f, 'name') || t('common.unknown-field');
		}
		if (tf?.kind === 'research') {
			const f = (researchFields || []).find((r) => String(r.id) === String(tf.fieldId));
			return content(f, 'name') || t('common.unknown-field');
		}
		return t('common.unknown-field');
	}
	function editTextFilter(tf) {
		const key = `${tf.kind === 'ontology' ? 'o' : 'r'}:${tf.fieldId}`;
		showAddTextSearch(key, tf.query || '');
	}
	function removeTextFilter(tf) {
		const arr = ensureTextFiltersArray();
		const idx = arr.findIndex(
			(x) => x.kind === tf.kind && String(x.fieldId) === String(tf.fieldId)
		);
		if (idx > -1) {
			arr.splice(idx, 1);
			onFiltersChange(advancedFilters);
		}
	}
</script>

<!-- Backdrop -->
<div
	class="position-fixed top-0 start-0 w-100 h-100"
	onkeydown={onClose}
	role="button"
	tabindex="0"
	style="background-color: rgba(0, 0, 0, 0.5); z-index: 1040;"
	onclick={onClose}
	transition:fade={{ duration: 150 }}
></div>

<!-- Side Menu -->
<div
    class="position-fixed top-0 end-0 vh-100 bg-white shadow d-flex flex-column"
    style="width: min(100%, 450px); max-width: 100%; z-index: 1050;"
    transition:fly={{ x: 350, duration: 300 }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="filters-title"
>
	<div class="d-flex justify-content-between align-items-center px-3 py-4 border-bottom">
		<h5 class="m-0" id="filters-title">{t('filters.title')}</h5>
		<button
			type="button"
			class="btn btn-link text-dark text-decoration-none p-0"
			aria-label={t('filters.close')}
			onclick={onClose}
		>
			<i class="bi bi-x fs-3"></i>
		</button>
	</div>

	<div class="flex-grow-1 overflow-auto position-relative">
		{#if activeView === 'main'}
			<div
				class="w-100 position-absolute"
				out:fly={{ x: -200, duration: 300 }}
				in:fly={{ x: -200, duration: 300, delay: 300 }}
			>
				<div
					class="p-3 d-flex justify-content-between align-items-center border-bottom"
					role="button"
					tabindex="0"
					onclick={() => showDetail({ name: t('filters.institutions'), type: 'institutions' })}
					onkeydown={() => showDetail({ name: t('filters.institutions'), type: 'institutions' })}
				>
					<p class="m-0">{t('filters.institutions')}</p>
					<i class="bi bi-chevron-right"></i>
				</div>

				{#if connectionResearchFields.length > 0}
					<div class="px-3 pt-3 pb-1 text-muted small text-uppercase fw-semibold">{t('filters.connections')}</div>
					{#each connectionResearchFields as field (field.id)}
						<div
							class="p-3 d-flex justify-content-between align-items-center border-bottom"
							role="button"
							tabindex="0"
							onclick={() => showDetail(field)}
							onkeydown={() => showDetail(field)}
						>
							<p class="m-0 fw-semibold">{content(field, 'name')}</p>
							<div class="d-flex align-items-center gap-2">
								<span class="text-muted">{getConnectionSelectionLabel(field)}</span>
								<i class="bi bi-chevron-right"></i>
							</div>
						</div>
					{/each}
				{/if}

				{#if textResearchFields.length > 0}
					<div class="px-3 pt-3 pb-1 text-muted small text-uppercase fw-semibold">{t('filters.research-fields')}</div>
					{#each textResearchFields as field (field.id)}
						<div
							class="p-3 d-flex justify-content-between align-items-center border-bottom"
							role="button"
							tabindex="0"
							onclick={() => showAddTextSearch(`r:${field.id}`, getCurrentTextQuery('research', field.id))}
							onkeydown={() => showAddTextSearch(`r:${field.id}`, getCurrentTextQuery('research', field.id))}
						>
							<p class="m-0 fw-semibold">{content(field, 'name')}</p>
							<div class="d-flex align-items-center gap-2">
								<span class="text-muted">{getCurrentTextQuery('research', field.id) || t('filters.all')}</span>
								<i class="bi bi-chevron-right"></i>
							</div>
						</div>
					{/each}
				{/if}

				{#if currentTextFilters.length > 0}
					<div class="px-3 pt-3 pb-1 text-muted small text-uppercase fw-semibold">{t('filters.active-text-searches')}</div>
					{#each currentTextFilters as tf (textFilterKey(tf))}
						<div class="p-3 d-flex justify-content-between align-items-center border-bottom">
							<p class="m-0">
								<span class="fw-semibold">{getTextFieldLabel(tf)}</span>
								<span class="text-muted ms-2">{t('common.quote-open')}{tf.query}{t('common.quote-close')}</span>
							</p>
							<div class="d-flex align-items-center">
								<button
									type="button"
									class="btn btn-outline-danger btn-sm me-2"
									aria-label={t('filters.remove-text-filter')}
									onclick={(e) => {
										e?.stopPropagation?.();
										removeTextFilter(tf);
									}}
								>
									<i class="bi bi-trash"></i>
								</button>
								<button
									type="button"
									class="btn btn-link text-dark text-decoration-none p-0"
									aria-label={t('filters.edit-text-filter')}
									onclick={(e) => {
										e?.stopPropagation?.();
										editTextFilter(tf);
									}}
								>
									<i class="bi bi-chevron-right"></i>
								</button>
							</div>
						</div>
					{/each}
				{/if}

				<div class="p-3">
					<button class="btn btn-outline-secondary" onclick={() => showAddTextSearch()}>
						<i class="bi bi-plus-circle"></i>
						<span>{t('filters.add-text-search')}</span>
					</button>
				</div>
			</div>
		{:else if activeView === 'addText'}
			<div
				class="w-100 position-absolute"
				in:fly={{ x: 200, duration: 300 }}
				out:fly={{ x: 200, duration: 300 }}
			>
				<div class="d-flex justify-content-between align-items-center p-3 border-bottom">
					<button class="btn btn-link p-0 text-decoration-none text-body" onclick={showMain}>
						<i class="bi bi-chevron-left me-2"></i>{t('filters.search-field')}
					</button>
					<!-- No Add button; search updates as you type -->
				</div>

				<div class="p-3">
					<div class="mb-3">
						<label class="form-label" for="text-filter-field-select">{t('filters.field')}</label>
						<select
							id="text-filter-field-select"
							class="form-select"
							bind:value={textSelectedFieldId}
							onchange={onTextFieldChange}
						>
							<option value="" disabled selected>{t('filters.choose-field')}</option>
							{#each selectableTextFields as f (f.key)}
								<option value={f.key}>{f.label}</option>
							{/each}
						</select>
					</div>
					<div class="mb-3">
						<label class="form-label" for="text-filter-query-input">{t('filters.search-text')}:</label>
						<input
							id="text-filter-query-input"
							type="text"
							class="form-control"
							placeholder={t('filters.search-text-placeholder')}
							bind:value={textQuery}
							oninput={onTextQueryInput}
						/>
					</div>
				</div>
			</div>
		{:else if selectedField}
			<div
				class="w-100 position-absolute"
				in:fly={{ x: 200, duration: 300 }}
				out:fly={{ x: 200, duration: 300 }}
				onoutroend={() => (selectedField = null)}
			>
				<div class="d-flex justify-content-between align-items-center p-3 border-bottom">
					<button class="btn btn-link p-0 text-decoration-none text-body" onclick={showMain}>
						<i class="bi bi-chevron-left me-2"></i>{selectedField.type === 'institutions' ? selectedField.name : content(selectedField, 'name')}
					</button>
					<button type="button" class="btn btn-link p-0" onclick={resetFilter}>{t('filters.reset')}</button>
				</div>

				<div class="p-3">
					<div class="input-group mb-3 border-0">
						<input
							type="text"
							class="form-control border-0"
							placeholder={t('filters.search-placeholder')}
							bind:value={searchTerm}
						/>
						<span class="input-group-text border-0"><i class="bi bi-search"></i></span>
					</div>
					<div class="list-group border-0">
						{#each filteredItems as item (item.id)}
							<div class="d-flex align-items-center justify-content-between">
								<div>
									<label
										class={`list-group-item border-0 d-flex align-items-center ${getFacetCountForItem(item) === 0 ? 'text-muted' : ''}`}
									>
										<input
											class="form-check-input me-3"
											type="checkbox"
											checked={isSelected(item.id)}
											onchange={() => toggleFilter(item.id)}
										/>
										{#if selectedField.type === 'vocabulary'}
											{#if item.main_asset_path}
												<img
													src={getAssetUrl({ asset_path: item.main_asset_path })}
													alt={content(item, 'name') || t('filters.vocabulary-thumbnail')}
													class="me-3"
													style="width: 32px; height: 32px; object-fit: cover; border: 1px solid #eee; border-radius: 4px;"
												/>
											{:else}
												<i class="text-secondary bi bi-image ms-2 me-4"></i>
											{/if}
										{/if}
										{content(item, 'name')}
										<span class=" badge bg-light text-secondary ms-2"
											>{getFacetCountForItem(item)}</span
										>
									</label>
								</div>
								{#if selectedField.type === 'vocabulary'}
									<div class="research-field-info">
										<button
											type="button"
											class="btn btn-link p-0 text-secondary"
											aria-label={t('filters.info')}
											onclick={() => toggleInfo(item)}
										>
											<i class="bi bi-info-circle"></i>
										</button>
									</div>
								{/if}
							</div>

							{#if selectedField.type === 'vocabulary' && openInfoId === item.id}
								<div
									class="research-field-info-panel border rounded p-2 my-2"
									in:fade={{ duration: 150 }}
									out:fade={{ duration: 150 }}
								>
									{#if item.main_asset_path}
										<img
											src={getAssetUrl({ asset_path: item.main_asset_path })}
											alt={content(item, 'name') || t('filters.vocabulary-image')}
											style="width: 100%; max-height: 240px; object-fit: contain; border-radius: 6px;"
										/>
									{:else}
										<div
											class="d-flex align-items-center justify-content-center bg-light rounded"
											style="height: 200px;"
										>
											<i class="bi bi-image text-secondary display-6"></i>
										</div>
									{/if}
									{#if content(item, 'description')}
										<p class="mt-2 mb-0 small">{content(item, 'description')}</p>
									{:else}
										<p class="mt-2 mb-0 text-muted small">{t('common.no-description-available')}</p>
									{/if}
								</div>
							{/if}
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
