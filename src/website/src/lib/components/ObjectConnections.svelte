<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { getConnectionColorsFromConfig } from '$lib/utils/connectionColors.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';

	let { objectResearchFields = [], researchFields = [], vocabularies = [] } = $props();
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	// Build enriched connection list: join objectResearchFields (vocabulary type) with vocabularies and researchFields
	const connections = $derived.by(() => {
		const rfMap = {};
		for (const rf of researchFields) {
			rfMap[rf.id] = rf;
		}
		const vocabMap = {};
		for (const v of vocabularies) {
			vocabMap[v.id] = v;
		}
		const results = [];
		for (const orf of objectResearchFields) {
			const rf = rfMap[orf.field_id];
			if (!rf || rf.type !== 'vocabulary') continue;
			const vocab = vocabMap[orf.vocabulary_id];
			if (!vocab) continue;
			const name = content(vocab, 'name') || '';
			if (!name) continue;
			const colors = getConnectionColorsFromConfig(rf?.fields_config);
			results.push({
				id: orf.id,
				fieldId: orf.field_id,
				vocabId: orf.vocabulary_id,
				label: content(rf, 'name') || '',
				name,
				mainAssetPath: vocab.main_asset_path || null,
				...colors
			});
		}
		return results;
	});

	function getVocabThumbnailUrl(mainAssetPath) {
		if (!mainAssetPath) return null;
		const url = getAssetUrl({ asset_path: mainAssetPath });
		// getAssetUrl may return empty string for bad inputs
		return url || null;
	}
</script>

{#if connections.length > 0}
	<div class="d-flex flex-column gap-2">
		<span class="text-uppercase fs-8 text-body">
			{t('object.connections')}
		</span>
		<div class="d-flex flex-column gap-2">
			{#each connections as conn}
				<div
					class="bg-white d-flex align-items-center p-2 rounded-3 gap-1"
					style="border-left: 3px solid {conn.border};"
				>
					{#if conn.mainAssetPath}
						<div
							class="overflow-hidden flex-shrink-0 rounded-circle"
							style="width: 41px; height: 41px;"
						>
							<img
								src={getVocabThumbnailUrl(conn.mainAssetPath)}
								alt={conn.name}
								class="w-100 h-100 object-fit-cover"
							/>
						</div>
					{/if}
					<div class="d-flex flex-column px-1">
						<span class="text-uppercase fs-8" style="color: {conn.text};">
							{conn.label}
						</span>
						<span class="fs-7 fw-semibold text-body">
							{conn.name}
						</span>
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
