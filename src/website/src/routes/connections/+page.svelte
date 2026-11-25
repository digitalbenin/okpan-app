<script>
	import { onMount } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	import { buildPathWithProjectId } from '$lib/utils/projectContext.js';
	import { resolveSitePath, resolveStaticHref } from '$lib/utils/sitePaths.js';
	import { getConnectionBorderColor } from '$lib/utils/connectionColors.js';
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
	let { data } = $props();
	const projectId = $derived(data?.activeProjectId || null);

	let connectionTypes = $state(data?.connection_types || []);
	let staticSettings = $state(null);
	let isLoading = $state(isStaticExport && data?.needsClientLoad);
	const headerDescription = $derived(content(staticSettings ?? data?.settings, 'connections_description'));

	onMount(async () => {
		if (isStaticExport && data?.needsClientLoad) {
			try {
				const response = await fetch(resolveSitePath('site.json'));
				const json = await response.json();
				connectionTypes = json.connection_types || [];
				staticSettings = json.settings || {};
			} catch (error) {
				console.error('[Connections] Failed to load site.json:', error);
			} finally {
				isLoading = false;
			}
		}
	});
</script>

{#if isLoading}
	<p class="text-muted p-4">{t('page.connections.loading')}</p>
{:else}
	<div class="bg-gray-200">
		<Header
			{...data}
			title={t('nav.connections')}
			description={headerDescription}
			useDescriptionFallback={false}
			showButton={false}
		/>
		<div
			class="container-xl mt-4"
		>
			{#if connectionTypes.length > 0}
				<div class="row g-3">
					{#each connectionTypes as type}
						<div class="col-lg-6 col-md-12">
							<a
								href={isStaticExport
									? resolveStaticHref(`connections/${type.id}`)
									: buildPathWithProjectId(`/connections/${type.id}`, projectId)}
								class="text-decoration-none text-dark d-block"
							>
								<div
									class="bg-white d-flex flex-column p-3 rounded-3 gap-1"
									style="border-left: 3px solid {getConnectionBorderColor(type?.fields_config)};"
								>
									<span class="fs-5 fw-semibold text-body">
										{content(type, 'name')}
									</span>
									<p class="fs-7 text-body mb-0" style="line-height: 1.5; min-height: 3em;">
										{content(type, 'description')}
									</p>
									<span class="fs-7 text-body-secondary">
										{t(type.count === 1 ? 'connections.count-one' : 'connections.count-other', { count: type.count || 0 })}
									</span>
								</div>
							</a>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-muted">{t('page.connections.empty')}</p>
			{/if}
		</div>
	</div>
{/if}
