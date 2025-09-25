<script>
	// Expected props from parent page data
	// - objectResearchFields: [{ id, value, field_id, vocabulary_id }]
	// - researchFields: [{ id, name, type, description? }]
	// - vocabularies (optional): [{ id, field_id, name }]
	const { objectResearchFields = [], researchFields = [], vocabularies = [] } = $props();

	// Fast lookup maps
	const researchById = $derived.by(() => {
		const m = new Map();
		(researchFields || []).forEach((rf) => m.set(String(rf.id), rf));
		return m;
	});
	const vocabById = $derived.by(() => {
		const m = new Map();
		(vocabularies || []).forEach((v) => m.set(String(v.id), v));
		return m;
	});

	// Map each object research field to include everything needed to render
	const mappedFields = $derived.by(() => {
		return (objectResearchFields || []).map((field) => {
			const rf = researchById.get(String(field.field_id));
			const type = rf?.type || 'freetext';
			const fieldName = rf?.name || '';
			const description = rf?.description?.content ?? rf?.description ?? null;
			let vocabularyName = null;
			let displayValue = '';

			if (type === 'vocabulary' && field.vocabulary_id) {
				vocabularyName = vocabById.get(String(field.vocabulary_id))?.name ?? null;
				displayValue = vocabularyName ?? '';
			} else {
				displayValue = field?.value ?? '';
			}

			return {
				...field,
				researchField: rf, // full research field
				fieldName,
				description,
				type,
				vocabularyName,
				displayValue
			};
		});
	});

	// Group by field id so that multi-valued fields (e.g. Materials) render together
	const grouped = $derived.by(() => {
		const byId = new Map();
		for (const f of mappedFields) {
			if (!f.fieldName) continue;
			const key = String(f.field_id);
			if (!byId.has(key)) {
				byId.set(key, {
					field_id: f.field_id,
					fieldName: f.fieldName,
					description: f.description,
					type: f.type,
					values: [],
				});
			}
			const group = byId.get(key);
			if (f.displayValue != null && f.displayValue !== '') {
				group.values.push(String(f.displayValue));
			}
		}
		// Order groups by the order of researchFields for consistent layout
		const orderIndex = new Map();
		(researchFields || []).forEach((rf, i) => orderIndex.set(String(rf.id), i));
		return Array.from(byId.values()).sort((a, b) => (orderIndex.get(String(a.field_id)) ?? 0) - (orderIndex.get(String(b.field_id)) ?? 0));
	});
</script>

{#if grouped.length > 0}
	<div class="d-flex flex-column border-top">
		{#each grouped as group (group.field_id)}
			<div class="d-flex align-items-start border-bottom py-2 px-1">
				<div class="col-3 text-break">
					<span class="badge bg-secondary-subtle text-dark">{group.fieldName}</span>
					<i class="bi bi-info-circle ms-1 text-muted" title={group.description || 'No description'}></i>
				</div>
				<div class="col-9 text-break">
					{#if group.values.length === 0}
						<span class="text-muted fst-italic">—</span>
					{:else if group.values.length === 1 || group.type !== 'vocabulary'}
						{group.values.join(', ')}
					{:else}
						{#each group.values as val}
							<div>{val}</div>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<p class="text-muted">No research fields available.</p>
{/if}

