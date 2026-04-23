<script>
	import { onMount } from 'svelte';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
	import { resolveSitePath, resolveStaticHref } from '$lib/utils/sitePaths.js';
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
	let { data } = $props();
	const projectId = $derived(data?.activeProjectId || null);

	let connectionTypes = $state(data?.connection_types || []);
	let isLoading = $state(isStaticExport && data?.needsClientLoad);

	onMount(async () => {
		if (isStaticExport && data?.needsClientLoad) {
			try {
				const response = await fetch(resolveSitePath('site.json'));
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
	<h1 class="mb-4">{t('nav.connections')}</h1>

	{#if isLoading}
		<p class="text-muted">{t('page.connections.loading')}</p>
	{:else}
		{#if connectionTypes.length > 0}
			<div class="d-flex flex-column gap-3">
				{#each connectionTypes as type}
					<a href={isStaticExport ? resolveStaticHref(`connections/${type.id}`) : buildPathWithProjectId(`/connections/${type.id}`, projectId)} class="text-decoration-none text-dark">
						<div class="card border rounded p-3 hover-shadow">
							<h3 class="fs-4 mb-0 fw-normal">
								{content(type, 'name')}
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
			<p class="text-muted">{t('page.connections.empty')}</p>
		{/if}
	{/if}
</div>
