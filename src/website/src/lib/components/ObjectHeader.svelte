<script>
	import { page } from '$app/stores';
	const { objId, institution } = $props();
	const proj_id = $page.url.searchParams.get('project_id');
</script>

<div class="object-header">
	<a
		href={`/?project_id=${proj_id}`}
		class="d-block text-decoration-none text-secondary text-opacity-75 mb-2"
	>
		<i class="bi bi-chevron-left"></i>
		BACK</a
	>
	<p class="mb-0">{institution?.name}</p>
	<h1 class="mt-0">{objId}</h1>
</div>
