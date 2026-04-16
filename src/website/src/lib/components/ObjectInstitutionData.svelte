<script>
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	let { objectOntologyFields = [], ontologyFields = [], datasources = [], institution } = $props();
	const { t } = getWebsiteTranslationStore();

	let mappedFields = $derived(
		objectOntologyFields.map((e) => ({
			...e,
			name: ontologyFields.find((f) => f.id == e.field_id)?.name
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
			ds?.name?.content ||
			ds?.name ||
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
				res = parsed.map((l) => ({ url: l?.url ?? l, label: l?.label ?? l?.name ?? t('common.link') }));
			}
		} catch (e) {
			console.error('malformed links section');
		} finally {
			return res;
		}
	}

	const websiteUrl = $derived.by(() => institution?.website || null);
	const linkItems = $derived.by(() => parseLinks(institution?.links));

	const countryText = $derived(institution?.country || null);
	const addressText = $derived(institution?.location || null);
</script>

<div class="bg-white mb-2 px-2">
	<div class="d-flex justify-content-between align-items-center mb-3">
		<h3 class="mb-0">{t('institution.title')}</h3>
	</div>

	<div class="row g-4">
		<div class="col-lg-12">
			{#if Object.keys(groupedFields).length > 0}
				<!-- Tab Navigation -->
				<ul class="nav nav-underline mb-3 border-bottom">
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

				<div class="row">
					<div class="col-md-8">
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
																	{field.name?.content || field.name || t('common.unknown')}
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
																	{isExpanded(fields[0].id) ? t('common.read-less') : t('common.read-more')}
																</button>
															{/if}
														{:else}
															<span class="text-muted fst-italic">{t('institution.value-placeholder')}</span>
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
					<div class="col-lg-4">
						<aside class="card border border-secondary-subtle rounded-3 p-3 bg-light">
							<h5 class="mb-3">{t('institution.about')}</h5>
							<div class="mb-3">
								<div class="label text-uppercase small fw-bold">{t('common.name')}</div>
								<div>{institution?.name || t('common.none')}</div>
							</div>
							<div class="mb-3">
								<div class="label text-uppercase small fw-bold">{t('common.country')}</div>
								<div>{countryText || t('common.none')}</div>
							</div>
							<div class="mb-3">
								<div class="label text-uppercase small fw-bold">{t('common.address')}</div>
								<div>{addressText || t('common.none')}</div>
							</div>
							{#if linkItems.length > 0}
								<div class="mb-3">
									<div class="label text-uppercase small fw-bold">{t('common.links')}</div>
									<ul class="list-unstyled mb-0">
										{#each linkItems as l}
											<li class="mb-1">
												<a
													class="link-primary"
													href={l.url}
													target="_blank"
													rel="noopener noreferrer">{l.label}</a
												>
											</li>
										{/each}
									</ul>
								</div>
							{:else if websiteUrl}
								<div class="mb-2">
									<div class="label text-uppercase text-muted small fw-semibold">{t('common.links')}</div>
									<a
										class="link-primary"
										href={websiteUrl}
										target="_blank"
										rel="noopener noreferrer">{t('common.website')}</a
									>
								</div>
							{/if}
						</aside>
					</div>
				</div>
			{:else}
				<div class="text-center text-muted py-4">
					<i class="bi bi-database fs-1 opacity-50"></i>
					<div class="mt-2">{t('institution.no-data-for-object')}</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Keep nav-underline styling consistent */
	.nav-underline .nav-link.active {
		font-weight: 400 !important;
	}
	.label {
		letter-spacing: 0.03em;
	}
</style>
