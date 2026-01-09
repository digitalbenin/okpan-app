<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	const { objectResearchFields = [], researchFields = [], vocabularies = [] } = $props();

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

	// Serialize vocabulary data for vanilla JS
	const vocabDataJson = $derived(JSON.stringify(
		(vocabularies || []).map(v => ({
			id: v.id,
			name: v.name,
			description: v.description,
			image: v.main_asset_path ? getAssetUrl({ asset_path: v.main_asset_path }) : null
		}))
	));
</script>

<svelte:head>
{@html `<script>
(function() {
	function initResearchModals() {
		document.querySelectorAll('.research-container').forEach(function(container) {
			if (container.dataset.init) return;
			container.dataset.init = 'true';
			
			var vocabs = [];
			try { vocabs = JSON.parse(container.dataset.vocabs || '[]'); } catch(e) {}
			var vocabMap = {};
			vocabs.forEach(function(v) { vocabMap[v.id] = v; });
			
			var modal = container.querySelector('.vocab-modal');
			var backdrop = container.querySelector('.vocab-backdrop');
			var modalTitle = container.querySelector('.vocab-modal-title');
			var modalBody = container.querySelector('.vocab-modal-body');
			
			function openModal(vocabId) {
				var v = vocabMap[vocabId];
				if (!v || !modal) return;
				
				modalTitle.textContent = v.name || '';
				var html = '';
				if (v.image) {
					html += '<img src="' + v.image + '" alt="' + (v.name || '') + '" class="img-fluid mb-2" />';
				}
				html += '<p>' + (v.description || '<span class="text-muted">No description available.</span>') + '</p>';
				modalBody.innerHTML = html;
				
				modal.classList.add('show');
				modal.style.display = 'block';
				backdrop.style.display = 'block';
				document.body.classList.add('modal-open');
			}
			
			function closeModal() {
				if (!modal) return;
				modal.classList.remove('show');
				modal.style.display = 'none';
				backdrop.style.display = 'none';
				document.body.classList.remove('modal-open');
			}
			
			container.querySelectorAll('.vocab-btn').forEach(function(btn) {
				btn.onclick = function() { openModal(btn.dataset.vocabId); };
			});
			
			// Bind ALL close buttons
			container.querySelectorAll('.vocab-modal-close').forEach(function(btn) {
				btn.onclick = closeModal;
			});
			if (backdrop) backdrop.onclick = closeModal;
		});
	}
	
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initResearchModals);
	} else {
		initResearchModals();
	}
})();
</script>`}
</svelte:head>

<div class="research-container" data-vocabs={vocabDataJson}>
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
							<button type="button" class="vocab-btn btn btn-link text-dark p-0" data-vocab-id={v.id}>{v.name}</button>
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	</div>
{:else}
	<p class="text-muted">No research fields available.</p>
{/if}

<!-- Modal -->
<div class="modal fade vocab-modal" tabindex="-1" role="dialog" aria-modal="true" style="display: none;">
	<div class="modal-dialog modal-dialog-centered" role="document">
		<div class="modal-content">
			<div class="modal-header">
				<h5 class="modal-title vocab-modal-title"></h5>
				<button type="button" class="btn-close vocab-modal-close" aria-label="Close"></button>
			</div>
			<div class="modal-body vocab-modal-body"></div>
			<div class="modal-footer">
				<button type="button" class="btn btn-secondary vocab-modal-close">Close</button>
			</div>
		</div>
	</div>
</div>
<div class="modal-backdrop fade show vocab-backdrop" style="display: none;"></div>
</div>
