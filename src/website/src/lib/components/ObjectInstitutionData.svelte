<script>
	let { objectOntologyFields = [], ontologyFields = [], datasources = [], institution } = $props();

	let mappedFields = $derived(
		objectOntologyFields.map((e) => ({
			...e,
			name: ontologyFields.find((f) => f.id == e.field_id)?.name
		}))
	);

	let fieldsByDatasource = $derived(
		mappedFields?.reduce((acc, item) => {
			const key = item.datasources_id;
			if (!acc[key]) acc[key] = [];
			acc[key].push(item);
			return acc;
		}, {})
	);


	function getDatasourceName(id) {
		const ds = datasources.find((d) => d.id == id);
		return (
			ds?.name?.content ||
			ds?.name ||
			(id === 'no-datasource' ? 'No Datasource' : 'Unknown datasource')
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
		return isExpanded(fieldId) ? text : text.substring(0, 160) + '...';
	};

	// --------------- Institution box helpers ---------------
	function parseLinks(raw) {
		if (!raw) return [];
		let res = [];
		try {
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) {
				res = parsed.map((l) => ({ url: l?.url ?? l, label: l?.label ?? l?.name ?? 'Link' }));
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
		<h3 class="mb-0">Institution data</h3>
	</div>

	<div class="row g-4">
		<div class="col-lg-12">
			{#if Object.keys(fieldsByDatasource).length > 0}
				<!-- Tab Navigation -->
				<ul class="nav nav-underline mb-3 border-bottom">
					{#each Object.entries(fieldsByDatasource) as [dsId, fields], i}
						<li class="nav-item">
							<button
								type="button"
								class="nav-link"
								class:active={(activeTabId ?? Object.keys(fieldsByDatasource)[0]) === dsId}
								role="tab"
								aria-selected={(activeTabId ?? Object.keys(fieldsByDatasource)[0]) === dsId}
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
						{#each Object.entries(fieldsByDatasource) as [dsId, fields], i}
							{#if (activeTabId ?? Object.keys(fieldsByDatasource)[0]) === dsId}
								{#if fields && fields.length > 0}
									<table class="table table-borderless">
										<thead>
											<tr class="border-bottom">
												<th scope="col" class="fw-bold">Institution field</th>
												<th scope="col" class="fw-bold">Matched field</th>
												<th scope="col" class="fw-bold">Value</th>
											</tr>
										</thead>
										<tbody>
											{#each fields as field (field.id)}
												<tr class="border-bottom">
													<td class="align-middle">
														{field.label || 'Untitled Field'}
													</td>
													<td class="align-middle">
														<div class="d-flex align-items-center">
															<i class="bi bi-arrow-right text-muted me-2"></i>
															<span class="badge bg-secondary-subtle text-dark">
																{field.name?.content || field.name || 'Unknown'}
															</span>
														</div>
													</td>
													<td class="align-middle">
														{#if field.value}
															<span>{getDisplayText(field.id, field.value)}</span>
															{#if shouldTruncate(field.value)}
																<button
																	type="button"
																	class="btn btn-link btn-sm p-0 ms-2 text-decoration-none"
																	onclick={() => toggleExpanded(field.id)}
																>
																	{isExpanded(field.id) ? 'read less' : 'read more'}
																</button>
															{/if}
														{:else}
															<span class="text-muted fst-italic">Value field</span>
														{/if}
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								{:else}
									<div class="text-center text-muted py-4">
										No ontology fields for this datasource
									</div>
								{/if}
							{/if}
						{/each}
					</div>
					<div class="col-lg-4">
						<aside class="card border border-secondary-subtle rounded-3 p-3 bg-light">
							<h5 class="mb-3">About the institution</h5>
							<div class="mb-3">
								<div class="label text-uppercase small fw-bold">Name</div>
								<div>{institution?.name || '—'}</div>
							</div>
							<div class="mb-3">
								<div class="label text-uppercase small fw-bold">Country</div>
								<div>{countryText || '—'}</div>
							</div>
							<div class="mb-3">
								<div class="label text-uppercase small fw-bold">Address</div>
								<div>{addressText || '—'}</div>
							</div>
							{#if linkItems.length > 0}
								<div class="mb-3">
									<div class="label text-uppercase small fw-bold">Links</div>
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
									<div class="label text-uppercase text-muted small fw-semibold">Links</div>
									<a
										class="link-primary"
										href={websiteUrl}
										target="_blank"
										rel="noopener noreferrer">Website</a
									>
								</div>
							{/if}
						</aside>
					</div>
				</div>
			{:else}
				<div class="text-center text-muted py-4">
					<i class="bi bi-database fs-1 opacity-50"></i>
					<div class="mt-2">No institution data found for this object</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	/* Keep nav-underline styling consistent */
	.nav-underline .nav-link.active,
	.nav-underline .show > .nav-link {
		font-weight: 400 !important;
	}
	.label {
		letter-spacing: 0.03em;
	}
</style>
