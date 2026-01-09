<script>
	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
	const { institution, title, projectId } = $props();
	// In static export mode, don't add project_id query param
	const backHref = (!isStaticExport && projectId) ? `/?project_id=${projectId}` : '/';
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
