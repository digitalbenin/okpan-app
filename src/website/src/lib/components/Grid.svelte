<script>
	import { getAssetUrl } from '$lib/utils/imgUtils.js';

	let { items = [], ontology_fields = [], institutions = [] } = $props();

	const ontologyFieldMap = $derived(
		ontology_fields.reduce((acc, field) => {
			acc[field.id] = field.name;
			return acc;
		}, {})
	);

	const institutionMap = $derived(
		institutions.reduce((acc, inst) => {
			acc[inst.id] = inst.name;
			return acc;
		}, {})
	);

	function getObjectTitle(item) {
		const titleFieldId = Object.keys(ontologyFieldMap).find(
			(id) => ontologyFieldMap[id] === 'object id'
		);
		return (
			item.objects_ontology_fields_json?.find((f) => f.field_id === titleFieldId)?.value ||
			'No Title'
		);
	}

	function getObjectType(item) {
		const typeFieldId = Object.keys(ontologyFieldMap).find(
			(id) => ontologyFieldMap[id] === 'designation'
		);
		return (
			item.objects_ontology_fields_json?.find((f) => f.field_id === typeFieldId)?.value || 'No Type'
		);
	}

	function getPrimaryAsset(item) {
		if (item.objects_assets_json && item.objects_assets_json.length > 0) {
			const primary = item.objects_assets_json.find((a) => a.order === 1);
			return primary || item.objects_assets_json[0];
		}
		return null;
	}

	function getObjectInstitution(item) {
		if (item.institution_id) {
			return institutionMap[item.institution_id];
		}
		return null;
	}
</script>

<div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4">
	{#each items as object (object.id)}
		{@const primaryAsset = getPrimaryAsset(object)}
		{@const institutionName = getObjectInstitution(object)}
		<div class="col">
			<div class="card h-100">
				{#if primaryAsset}
					<img
						src={getAssetUrl(primaryAsset)}
						class="card-img-top"
						alt={getObjectTitle(object)}
						style="height: 200px; object-fit: cover;"
					/>
				{:else}
					<div
						class="card-img-top d-flex align-items-center justify-content-center bg-light"
						style="height: 200px;"
					>
						<span class="text-muted">No Image</span>
					</div>
				{/if}
				<div class="card-body">
					<h5 class="card-title mb-3">{getObjectTitle(object)}</h5>

					<p class="card-text mb-2">
						<small class="text-muted">English designation</small><br />
						{getObjectType(object)}
					</p>

					{#if institutionName}
						<p class="card-text mb-2">
							<small class="text-muted">Institution</small><br />
							{institutionName}
						</p>
					{/if}
				</div>
			</div>
		</div>
	{/each}
</div>
