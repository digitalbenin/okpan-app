<script>
	let { objectOntologyFields = [], ontologyFields, datasources } = $props();

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

	$inspect(fieldsByDatasource);

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
</script>

<div class="bg-white mb-2 px-2">
	<div class="d-flex justify-content-between align-items-center mb-3">
		<h3 class="mb-0">Institution data</h3>
	</div>

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
					<div class="text-center text-muted py-4">No ontology fields for this datasource</div>
				{/if}
			{/if}
		{/each}
	{:else}
		<div class="text-center text-muted py-4">
			<i class="bi bi-database fs-1 opacity-50"></i>
			<div class="mt-2">No institution data found for this object</div>
		</div>
	{/if}
</div>

<style>
	/* Keep nav-underline styling consistent */
	.nav-underline .nav-link.active,
	.nav-underline .show > .nav-link {
		font-weight: 400 !important;
	}
</style>
