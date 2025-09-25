<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { fly } from 'svelte/transition';

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

	function getObjectTitle() {
		const titleFieldId = Object.keys(ontologyFieldMap).find(
			(id) => ontologyFieldMap[id] === 'object id'
		);
		return (
			object?.objects_ontology_fields_json?.find((f) => f.field_id === titleFieldId)?.value ||
			'No Title'
		);
	}

	// TODO: define a way to get a meaningful field
	function getObjectType() {
		const typeFieldId = Object.keys(ontologyFieldMap).find(
			(id) => ontologyFieldMap[id] === 'designation'
		);
		return (
			object?.objects_ontology_fields_json?.find((f) => f.field_id === typeFieldId)?.value || 'No Type'
		);
	}

	function getInstitutionName() {
		if (object?.institution_id) {
			return institutionMap[object.institution_id] || null;
		}
		return null;
	}
</script>

<div class="card h-100">
	<div class="bg-secondary-subtle w-100 position-relative" style="height: 200px; overflow: hidden;">
		{#key clampedIndex}
			<div
				class="position-absolute top-0 start-0 w-100 h-100"
				in:fly={{ x: slideDir === 'next' ? 120 : -120, duration: 200 }}
				out:fly={{ x: slideDir === 'next' ? -120 : 120, duration: 200 }}
			>
				{#if imageUrl}
					<img
						src={imageUrl}
						class="card-img-top object-fit-contain"
						alt={getObjectTitle()}
						style="height: 100%; width: 100%; object-fit: cover;"
					/>
				{:else}
					<div
						class="card-img-top d-flex flex-column align-items-center justify-content-center"
						style="height: 100%;"
					>
						<i class="bi bi-image text-secondary display-5"></i>
						<span class="text-muted">No Image</span>
					</div>
				{/if}
			</div>
		{/key}

		{#if assets.length > 1}
			<button
				type="button"
				class="btn btn-light btn-sm position-absolute top-50 start-0 translate-middle-y ms-2 opacity-75"
				aria-label="Previous image"
				onclick={prevAsset}
			>
				<i class="bi bi-chevron-left"></i>
			</button>
			<button
				type="button"
				class="btn btn-light btn-sm position-absolute top-50 end-0 translate-middle-y me-2 opacity-75"
				aria-label="Next image"
				onclick={nextAsset}
			>
				<i class="bi bi-chevron-right"></i>
			</button>
		{/if}
	</div>
	<div class="card-body">
		<h5 class="card-title mb-3">{getObjectTitle()}</h5>

		<p class="card-text mb-2">
			<small class="text-muted">Designation</small><br />
			{getObjectType()}
		</p>

		{#if getInstitutionName()}
			<p class="card-text mb-2">
				<small class="text-muted">Institution</small><br />
				{getInstitutionName()}
			</p>
		{/if}
	</div>
</div>
