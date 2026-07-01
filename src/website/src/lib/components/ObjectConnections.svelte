<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';

	let { objectResearchFields = [], researchFields = [], vocabularies = [] } = $props();
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	// Map template IDs to actual hex colors (matching SCSS primitives)
	const TEMPLATE_COLORS = {
		custom: { border: '#0DCAF0', text: '#087990' },
		indigenous_designation: { border: '#D3A621', text: '#7F6414' },
		iconography: { border: '#1470CC', text: '#0C437A' },
		place: { border: '#2D2DB2', text: '#1A1A7A' },
		oral_history: { border: '#FD7E14', text: '#984C0C' },
		people: { border: '#008060', text: '#004D3A' }
	};

	const DEFAULT_COLORS = { border: '#A2A39D', text: '#51524E' };

	function getConnectionColors(field) {
		if (!field?.fields_config) return DEFAULT_COLORS;
		let config = field.fields_config;
		if (typeof config === 'string') {
			try { config = JSON.parse(config); } catch { return DEFAULT_COLORS; }
		}
		const templateId = config?.templateId;
		return TEMPLATE_COLORS[templateId] || DEFAULT_COLORS;
	}

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
			const colors = getConnectionColors(rf);
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
