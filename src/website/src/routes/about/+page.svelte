<script>
	import { onMount } from 'svelte';
	import { getAssetUrl } from '$lib/utils/imgUtils.js';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	import { resolveSitePath } from '$lib/utils/sitePaths.js';
	const { t } = getWebsiteTranslationStore();
	const { content } = getWebsiteContentStore();

	const isStaticExport = import.meta.env.VITE_USE_JSON === 'true';
	let { data } = $props();

	let staticProject = $state(null);
	let staticSettings = $state(null);
	const project = $derived.by(() => staticProject || data?.project || {});
	const settings = $derived.by(() => staticSettings || data?.settings || {});
	let isLoading = $state(isStaticExport && data?.needsClientLoad);

	const titleText = $derived.by(() => content(settings, 'title', content(project, 'name')) || t('nav.about'));
	const aboutText = $derived.by(() => content(settings, 'about', content(project, 'description')) || content(settings, 'description') || '');
	const logoUrl = $derived.by(() => (settings?.logo_asset_path ? getAssetUrl({ asset_path: settings.logo_asset_path }) : ''));

	onMount(async () => {
		if (isStaticExport && data?.needsClientLoad) {
			try {
				const response = await fetch(resolveSitePath('site.json'));
				const json = await response.json();
				staticProject = json.project || {};
				staticSettings = json.settings || {};
			} catch (error) {
				console.error('[About] Failed to load site.json:', error);
			} finally {
				isLoading = false;
			}
		}
	});
</script>

<div class="py-4">
	<h1 class="mb-4">{titleText}</h1>

	{#if isLoading}
		<p class="text-muted">{t('page.about.loading')}</p>
	{:else}
		{#if logoUrl}
			<img src={logoUrl} alt={titleText} class="img-fluid mb-4" style="max-height: 220px;" />
		{/if}

		{#if aboutText}
			<p class="" style="white-space: pre-wrap;">{aboutText}</p>
		{:else}
			<p class="text-muted">{t('page.about.empty')}</p>
		{/if}
	{/if}
</div>
