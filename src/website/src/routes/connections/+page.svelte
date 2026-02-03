<script>
	import { onMount } from 'svelte';

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
	let { data } = $props();

	let connectionTypes = $state(data?.connection_types || []);
	let isLoading = $state(isStaticExport && data?.needsClientLoad);

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
			<div class="ms-1 list-group list-group-flush row g-3 ">
				{#each connectionTypes as type}
					<div class="col-md-4 list-group-item p-0 border rounded">
						<p class="fw-bold mb-1 bg-light p-3">{type.name}</p>
						{#if type.description}
							<p class="mb-0 text-muted p-3">{type.description}</p>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-muted">No connection types defined.</p>
		{/if}
	{/if}
</div>
