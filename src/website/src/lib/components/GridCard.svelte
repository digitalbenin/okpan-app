<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	import { resolveStaticHref } from '$lib/utils/sitePaths.js';
	import { fly } from 'svelte/transition';
    const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';

	let { object, ontologyFieldMap = {}, institutionMap = {} } = $props();

	function getAssets() {
		return object?.objects_assets_json || [];
	}

	function getDefaultAssetIndex() {
		const list = getAssets();
		if (!list.length) return 0;
		const idx = list.findIndex((a) => Number(a.order) === 1);
		return idx >= 0 ? idx : 0;
	}

	// Local state for current asset index (per card)
	let currentIndex = $state(getDefaultAssetIndex());
	let slideDir = $state('next'); // 'next' or 'prev' to determine fly direction

	const assets = $derived(getAssets());

	// Clamp the index safely without mutating state during render
	const clampedIndex = $derived.by(() => {
		const len = assets.length;
		if (len === 0) return 0;
		return ((currentIndex % len) + len) % len;
	});

	const currentAsset = $derived.by(() => {
		const a = assets;
		if (!a.length) return null;
		return a[clampedIndex] || null;
	});

	// Derive a safe URL string identical to prior behavior
	const imageUrl = $derived.by(() => {
		if (!currentAsset) return '';
		const path = currentAsset.asset_path || currentAsset.path || '';
		if (!path) return '';
		return getAssetUrl({ asset_path: path });
	});

	function prevAsset() {
		const len = assets.length;
		if (len <= 1) return;
		slideDir = 'prev';
		currentIndex = (clampedIndex - 1 + len) % len;
	}

	function nextAsset() {
		const len = assets.length;
		if (len <= 1) return;
		slideDir = 'next';
		currentIndex = (clampedIndex + 1) % len;
	}

    function getPrimaryIdentifier() {
        const field = object?.objects_ontology_fields_json?.find((f) => f.primary);
        return field?.value ?? null;
    }

    function getObjectDisplayName() {
		const name = (content(object, 'name') && String(content(object, 'name')).trim()) || '';
        if (name) return name;
        const primaryId = getPrimaryIdentifier();
        if (primaryId) return primaryId;
        // Fallback to field named "object id" if available
        const titleFieldId = Object.keys(ontologyFieldMap).find(
            (id) => String(ontologyFieldMap[id] || '').toLowerCase() === 'object id'
        );
        const byField = object?.objects_ontology_fields_json?.find((f) => f.field_id === titleFieldId)?.value;
		return byField || object?.id || t('object.no-title');
    }

	// TODO: define a way to get a meaningful field
    function getObjectType() {
        const typeFieldId = Object.keys(ontologyFieldMap).find(
            (id) => String(ontologyFieldMap[id] || '').toLowerCase() === 'designation'
        );
        const val = object?.objects_ontology_fields_json?.find((f) => f.field_id === typeFieldId)?.value;
		return val || t('object.no-type');
    }

	function getInstitutionName() {
		if (object?.institution_id) {
			return institutionMap[object.institution_id] || null;
		}
		return null;
	}

	function getObjectHref() {
		if (!isStaticExport) {
			return `/${object.id}?project_id=${object.project_id}`;
		}

		return `${resolveStaticHref(`${object.id}`)}?back=`;
	}
</script>

<div class="card h-100 border-secondary-subtle rounded-4 overflow-hidden">
	<div class="ratio ratio-1x1 mb-3 overflow-hidden">
		<div>
			{#key clampedIndex}
				<div
					class="position-absolute top-0 start-0 w-100 h-100 bg-secondary"
					in:fly={{ x: slideDir === 'next' ? 120 : -120, duration: 200 }}
					out:fly={{ x: slideDir === 'next' ? -120 : 120, duration: 200 }}
				>
					{#if imageUrl}
                    <img
                        src={imageUrl}
                        class="card-img-top object-fit-contain"
                        alt={getObjectDisplayName()}
                        style="height: 100%; width: 100%; object-fit: contain;"
                    />
					{:else}
						<div
							class="card-img-top d-flex flex-column align-items-center justify-content-center"
							style="height: 100%;"
						>
							<i class="bi bi-image text-secondary display-5"></i>
							<span class="text-muted">{t('object.no-image')}</span>
						</div>
					{/if}
				</div>
			{/key}

			{#if assets.length > 1}
				<div class="position-absolute top-50 start-0 translate-middle-y z-2 ps-1">
					<button
						type="button"
						class="d-flex align-items-center justify-content-center prev btn btn-secondary btn-sm p-0 rounded-circle aspect-ratio-1x1 border-0 opacity-50 flex-shrink-0"
						style="width: 20px; height: 20px;"
						aria-label={t('media.previous-image')}
						onclick={prevAsset}
					>
						<i style="font-size: 8px;" class="bi bi-chevron-left"></i>
					</button>
				</div>
				<div class="position-absolute top-50 end-0 translate-middle-y z-2 pe-1">
					<button
						type="button"
						class="d-flex align-items-center justify-content-center next btn btn-secondary btn-sm rounded-circle aspect-ratio-1x1 border-0 opacity-50 p-0"
						style="width: 20px; height: 20px;"
						aria-label={t('media.next-image')}
						onclick={nextAsset}
					>
						<i style="font-size: 8px;" class="bi bi-chevron-right"></i>
					</button>
				</div>
			{/if}
		</div>
	</div>
	<div class="card-body">
        <h5 class="card-title mb-3">
            <a
                class="text-dark text-decoration-none"
				href={getObjectHref()}>{getObjectDisplayName()}</a
            >
		</h5>		<p class="card-text mb-2">
			<small class="text-muted">{t('object.designation')}</small><br />
			{getObjectType()}
		</p>

		{#if getInstitutionName()}
			<p class="card-text mb-2">
				<small class="text-muted">{t('object.institution')}</small><br />
				{getInstitutionName()}
			</p>
		{/if}
	</div>
</div>
