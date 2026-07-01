<script>
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	let { objectOntologyFields = [], ontologyFields = [], datasources = [], institution } = $props();
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	let mappedFields = $derived(
		objectOntologyFields
			.filter((e) => {
				const def = ontologyFields.find((f) => f.id == e.field_id);
				return def && def.onwebsite !== 0;
			})
			.map((e) => ({
				...e,
				name: content(
					ontologyFields.find((f) => f.id == e.field_id),
					'name'
				)
			}))
	);

	let groupedFields = $derived(
		mappedFields?.reduce((acc, item) => {
			const dsId = item.datasources_id;
			const label = item.label || t('common.unknown-field');

			if (!acc[dsId]) acc[dsId] = {};
			if (!acc[dsId][label]) acc[dsId][label] = [];

			acc[dsId][label].push(item);
			return acc;
		}, {})
	);

	function getDatasourceName(id) {
		const ds = datasources.find((d) => d.id == id);
		return (
			content(ds, 'name') ||
			(id === 'no-datasource' ? t('common.no-datasource') : t('common.unknown-datasource'))
		);
	}

	// Active tab handling without $effect; default to first tab when none selected
	let activeTabId = $state(null);

	// Text truncation logic
	let expandedFields = $state(new Set());
	const shouldTruncate = (text) => typeof text === 'string' && text.length > 160;
	const isExpanded = (fieldId) => expandedFields.has(fieldId);
	const toggleExpanded = (fieldId) => {
		if (expandedFields.has(fieldId)) expandedFields.delete(fieldId);
		else expandedFields.add(fieldId);
		expandedFields = new Set(expandedFields);
	};
	const getDisplayText = (fieldId, text) => {
		if (!text) return '';
		if (!shouldTruncate(text)) return text;
		return isExpanded(fieldId) ? text : text.substring(0, 160) + t('common.ellipsis');
	};

	// --------------- Institution box helpers ---------------
	function parseLinks(raw) {
		if (!raw) return [];
		let res = [];
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				res = parsed.map((l) => ({
					url: l?.url ?? l,
					label: l?.label ?? l?.name ?? t('common.link')
				}));
			}
		} catch (e) {
			console.error('malformed links section');
		} finally {
			return res;
		}
	}

	const websiteUrl = $derived.by(() => institution?.website || null);
	const linkItems = $derived.by(() => parseLinks(institution?.links));

	const countryText = $derived(content(institution, 'country') || null);
	const addressText = $derived(content(institution, 'location') || null);
</script>

<div class="d-flex flex-column pt-3">
	{#if Object.keys(groupedFields).length > 0}
		
		<div class="row g-4">
			<div class="col-lg-8 col-md-12 rounded mt-0">
            <span class="text-uppercase fs-8 d-block mb-2">
			{t('institution.title')}
		</span> 
            <div class="bg-white p-3">
				<!-- Tab Navigation -->
				<ul class="nav nav-underline mb-3 border-bottom bg-white">
					{#each Object.entries(groupedFields) as [dsId, fieldsByLabel], i}
						<li class="nav-item">
							<button
								type="button"
								class="nav-link"
								class:active={(activeTabId ?? Object.keys(groupedFields)[0]) === dsId}
								role="tab"
								aria-selected={(activeTabId ?? Object.keys(groupedFields)[0]) === dsId}
								onclick={() => (activeTabId = dsId)}
							>
								{getDatasourceName(dsId)}
							</button>
						</li>
					{/each}
				</ul>

				<!-- Tab Content (only the active one shown) -->
				{#each Object.entries(groupedFields) as [dsId, fieldsByLabel], i}
					{#if (activeTabId ?? Object.keys(groupedFields)[0]) === dsId}
						{#if Object.keys(fieldsByLabel).length > 0}
							<table class="table table-sm">
								<thead>
									<tr>
										<th style="width: 25%">{t('institution.field')}</th>
										<th style="width: 30%">{t('institution.matched-field')}</th>
										<th style="width: 45%">{t('institution.value')}</th>
									</tr>
								</thead>
								<tbody>
									{#each Object.entries(fieldsByLabel) as [label, fields]}
										<tr>
											<td class="text-muted">{label}</td>
											<td>
												<div class="d-flex flex-wrap gap-1">
													{#each fields as field}
														<span class="badge bg-secondary-subtle text-secondary-emphasis">
															{field.name || t('common.unknown')}
														</span>
													{/each}
												</div>
											</td>
											<td style="word-break: break-word; overflow-wrap: break-word; max-width: 0;">
												{#if fields[0]?.value}
													<span>{getDisplayText(fields[0].id, fields[0].value)}</span>
													{#if shouldTruncate(fields[0].value)}
														<button
															type="button"
															class="btn btn-link btn-sm p-0 ms-2 text-decoration-none"
															onclick={() => toggleExpanded(fields[0].id)}
														>
															{isExpanded(fields[0].id)
																? t('common.read-less')
																: t('common.read-more')}
														</button>
													{/if}
												{:else}
													<span class="text-muted fst-italic"
														>{t('institution.value-placeholder')}</span
													>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{:else}
							<div class="text-center text-muted py-4">
								{t('institution.no-fields-for-datasource')}
							</div>
						{/if}
					{/if}
				{/each}
                </div>
			</div>
			<div class="col-lg-4 col-md-12 mt-0 mt-md-4">
				<div class="d-flex flex-column gap-2">
					<span class="text-uppercase fs-8 text-body">
						{t('object.institution')}
					</span>
					<div class="bg-white d-flex flex-column p-3 rounded-2 gap-3">
						<span class="h5 text-body-secondary mb-0">
							{content(institution, 'name') || ''}
						</span>
						<div class="d-flex flex-column">
							<span class="text-uppercase fs-8 text-body">
								{t('common.country')}
							</span>
							<span class="fs-7 text-body-secondary">
								{countryText || t('common.none')}
							</span>
						</div>
						<div class="d-flex flex-column">
							<span class="text-uppercase fs-8 text-body">
								{t('common.address')}
							</span>
							<span class="fs-7 text-body-secondary">
								{addressText || t('common.none')}
							</span>
						</div>
						{#if linkItems.length > 0}
							{#each linkItems as l}
								<div class="d-flex flex-column">
									<span class="text-uppercase fs-8 text-body">
										{t('common.links')}
									</span>
									<a
										href={l.url}
										target="_blank"
										rel="noopener noreferrer"
										class="fs-7 text-body-secondary"
									>
										{l.label}
									</a>
								</div>
							{/each}
						{:else if websiteUrl}
							<div class="d-flex flex-column">
								<span class="text-uppercase fs-8 text-body">
									{t('common.links')}
								</span>
								<a
									href={websiteUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="fs-7 text-body-secondary"
								>
									{t('common.website')}
								</a>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center text-muted py-4">
			<i class="bi bi-database fs-1 opacity-50"></i>
			<div class="mt-2">{t('institution.no-data-for-object')}</div>
		</div>
	{/if}
</div>


