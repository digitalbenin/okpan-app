<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	const { objectResearchFields = [], researchFields = [], vocabularies = [] } = $props();

	let selectedVocabulary = $state(null);

	function openVocab(vocabulary) {
		selectedVocabulary = vocabulary;
	}

	function closeModal() {
		selectedVocabulary = null;
	}

	// Build lookup maps
	const researchById = new Map((researchFields || []).map(rf => [String(rf.id), rf]));
	const vocabById = new Map((vocabularies || []).map(v => [String(v.id), v]));

	// Group fields by field_id
	const grouped = $derived.by(() => {
		const byId = Object.create(null);
		for (const f of objectResearchFields || []) {
			const rf = researchById.get(String(f.field_id));
			if (!rf?.name) continue;
			
			const type = rf.type || 'freetext';
			const key = String(f.field_id);
			const g = byId[key] ?? (byId[key] = {
				field_id: f.field_id,
				fieldName: rf.name,
				description: rf.description?.content ?? rf.description ?? null,
				type,
				values: []
			});
			
			if (type === 'vocabulary' && f.vocabulary_id) {
				const v = vocabById.get(String(f.vocabulary_id));
				if (v?.name) {
					g.values.push({
						id: String(f.vocabulary_id),
						name: v.name,
						description: v.description ?? null,
						main_asset_path: v.main_asset_path ?? null
					});
				}
			} else if (f.value) {
				g.values.push(String(f.value));
			}
		}
		
		const orderIndex = new Map((researchFields || []).map((rf, i) => [String(rf.id), i]));
		return Object.values(byId)
			.filter(g => g.values.length > 0)
			.sort((a, b) => (orderIndex.get(String(a.field_id)) ?? 0) - (orderIndex.get(String(b.field_id)) ?? 0));
	});

</script>

<div class="research-container">
{#if grouped.length > 0}
	<div class="d-flex flex-column border-top">
		{#each grouped as group (group.field_id)}
			<div class="d-flex align-items-start border-bottom py-2 px-1">
				<div class="col-3 text-break">
					<span class="badge bg-secondary-subtle text-dark">{group.fieldName}</span>
					<i class="bi bi-info-circle ms-1 text-muted" title={group.description || 'No description'}></i>
				</div>
				<div class="col-9 text-break">
					{#if group.type !== 'vocabulary'}
						{group.values.join(', ')}
					{:else}
						{#each group.values as v, i}
							{#if i > 0}, {/if}
							<button
								type="button"
								class="btn btn-link text-dark p-0"
								onclick={() => openVocab(v)}
							>
								{v.name}
							</button>
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
		role="dialog"
		aria-modal="true"
		tabindex="0"
		onclick={(event) => event.target === event.currentTarget && closeModal()}
		onkeydown={(event) => event.key === 'Escape' && closeModal()}
	>
		<div class="modal-dialog modal-dialog-centered" role="document">
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
					<button type="button" class="btn btn-secondary" onclick={closeModal}>Close</button>
				</div>
			</div>
		</div>
	</div>
{/if}
</div>
