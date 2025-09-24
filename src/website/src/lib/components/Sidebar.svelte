<script>
	let { project } = $props();
</script>

<div class="flex align-items-between sticky-top">
	<div class="w-100 my-3 d-flex justify-content-start">
		<i class="bi bi-image text-secondary opacity-50 display-1"></i>
	</div>
	{#if project}
		<h1 class="mb-4">{project.name}</h1>
		<p>{project.description}</p>
	{/if}
</div>
