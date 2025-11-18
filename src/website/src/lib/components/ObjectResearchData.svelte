<script>
	// Expected props from parent page data
	// - objectResearchFields: [{ id, value, field_id, vocabulary_id }]
	// - researchFields: [{ id, name, type, description? }]
	// - vocabularies (optional): [{ id, field_id, name }]
	const { objectResearchFields = [], researchFields = [], vocabularies = [] } = $props();
	import { getAssetUrl } from '$lib/utils/imgUtils.js';

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

	// Modal state for vocabulary details
	let selectedVocabulary = $state(null);
	function openVocab(v) {
		selectedVocabulary = v;
	}
	function closeModal() {
		selectedVocabulary = null;
	}

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
		const byId = Object.create(null);
		for (const f of mappedFields) {
			if (!f.fieldName) continue;
			const dv = f.displayValue;
			if (dv == null || dv === '') continue;
			const key = String(f.field_id);
			const g =
				byId[key] ??
				(byId[key] = {
					field_id: f.field_id,
					fieldName: f.fieldName,
					description: f.description,
					type: f.type,
					values: []
				});
			if (f.type === 'vocabulary' && f.vocabulary_id) {
				const v = vocabById?.get
					? vocabById.get(String(f.vocabulary_id))
					: (vocabularies || []).find((vv) => String(vv.id) === String(f.vocabulary_id));
				g.values.push({
					id: String(f.vocabulary_id),
					name: v?.name ?? String(dv),
					description: v?.description ?? null,
					main_asset_path: v?.main_asset_path ?? null
				});
			} else {
				g.values.push(String(dv));
			}
		}
		const orderIndex = Object.fromEntries(
			(researchFields || []).map((rf, i) => [String(rf.id), i])
		);
		return Object.values(byId).sort(
			(a, b) => (orderIndex[String(a.field_id)] ?? 0) - (orderIndex[String(b.field_id)] ?? 0)
		);
	});

</script>

{#if grouped.length > 0}
	<div class="d-flex flex-column border-top">
		{#each grouped as group (group.field_id)}
			<div class="d-flex align-items-start border-bottom py-2 px-1">
				<div class="col-3 text-break">
					<span class="badge bg-secondary-subtle text-dark">{group.fieldName}</span>
					<i class="bi bi-info-circle ms-1 text-muted" title={group.description || 'No description'}
					></i>
				</div>
				<div class="col-9 text-break">
					{#if group.values.length === 0}
						<span class="text-muted fst-italic">—</span>
					{:else if group.type !== 'vocabulary'}
						{group.values.join(', ')}
					{:else if group.values.length === 1}
						{#if group.values[0]}
							<button class="btn btn-link text-dark p-0" onclick={() => openVocab(group.values[0])}>
								{group.values[0].name}
							</button>
						{/if}
					{:else}
						{#each group.values as v}
							<div>
								<button class="btn btn-link text-dark p-0" onclick={() => openVocab(v)}
									>{v.name}</button
								>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<p class="text-muted">No research fields available.</p>
{/if}

{#if selectedVocabulary}
	<div
		class="modal fade show d-block"
		style="background-color: rgba(0,0,0,0.5);"
		onclick={closeModal}
		onkeydown={closeModal}
	>
		<div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
			<div class="modal-content">
				<div class="modal-header">
					<h5 class="modal-title">{selectedVocabulary.name}</h5>
					<button type="button" class="btn-close" aria-label="Close" onclick={closeModal}></button>
				</div>
				<div class="modal-body">
					{#if selectedVocabulary.main_asset_path}
						<img
							src={getAssetUrl({ asset_path: selectedVocabulary.main_asset_path })}
							alt={selectedVocabulary.name}
							class="img-fluid mb-2"
						/>
					{/if}
					{#if selectedVocabulary.description}
						<p>{selectedVocabulary.description}</p>
					{:else}
						<p class="text-muted">No description available.</p>
					{/if}
				</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" onclick={closeModal}>Close</button>
				</div>
			</div>
		</div>
	</div>
{/if}
