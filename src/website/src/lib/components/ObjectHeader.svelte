<script>
	const { institution, title, projectId } = $props();
	const backHref = projectId ? `/?project_id=${projectId}` : '/';
</script>

<div class="object-header">
	<a
		href={backHref}
		class="d-block text-decoration-none text-secondary text-opacity-75 mb-2"
	>
		<i class="bi bi-chevron-left"></i>
		BACK</a
	>
	<p class="mb-0">{institution?.name}</p>
	<h1 class="mt-0">{title}</h1>
</div>
