<script>
	import { onMount } from 'svelte';
	import { currentProjectId } from '$lib/stores/project.js';

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
	let { data } = $props();

	let connectionTypes = $state(data?.connection_types || []);
	let isLoading = $state(isStaticExport && data?.needsClientLoad);

	// Preserve project_id in links (preview mode only)
	const projectQuery = $derived.by(() => $currentProjectId ? `?project_id=${$currentProjectId}` : '');

	onMount(async () => {
		if (isStaticExport && data?.needsClientLoad) {
			try {
				const response = await fetch('/site.json');
				const json = await response.json();
				connectionTypes = json.connection_types || [];
			} catch (error) {
				console.error('[Connections] Failed to load site.json:', error);
			} finally {
				isLoading = false;
			}
		}
	});
</script>

<div class=" py-4">
	<h1 class="mb-4">Connections</h1>

	{#if isLoading}
		<p class="text-muted">Loading connections…</p>
	{:else}
		{#if connectionTypes.length > 0}
			<div class="d-flex flex-column gap-3">
				{#each connectionTypes as type}
					<a href={`/connections/${type.id}${projectQuery}`} class="text-decoration-none text-dark">
						<div class="card border rounded p-3 hover-shadow">
							<h3 class="fs-4 mb-0 fw-normal">
								{type.name}
								<sup class="fs-6 fw-bold text-secondary">{type.count !== undefined ? type.count : ''}</sup>
							</h3>
							<!--{#if type.description}
								<p class="mb-0 text-muted mt-2">{type.description}</p>
							{/if}-->
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<p class="text-muted">No connection types defined.</p>
		{/if}
	{/if}
</div>
