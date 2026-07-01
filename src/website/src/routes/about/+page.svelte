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

	const titleText = $derived.by(() => content(settings, 'title') || content(project, 'name') || t('site.untitled-project'));
	const aboutHtml = $derived.by(() => content(settings, 'about', content(project, 'description')) || content(settings, 'description') || '');
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

{#if isLoading}
	<div class="bg-gray-200 min-vh-100 px-5 py-4">
		<p class="text-muted">{t('page.about.loading')}</p>
	</div>
{:else}
	<div class="bg-gray-200 min-vh-100">
		<div class="container-xl py-5">
			<div class="row g-4">
				<!-- Image column - first in source (top on mobile), right on desktop -->
				<div class="col-lg-4 col-md-12 order-lg-last">
					<div class="d-flex justify-content-lg-end">
						<div class="overflow-hidden rounded-2" style="width: 275px; height: 275px;">
							{#if logoUrl}
								<img src={logoUrl} alt="" class="w-100 h-100 object-fit-cover" />
							{:else}
								<div class="w-100 h-100 bg-light d-flex align-items-center justify-content-center text-secondary">
									<i class="bi bi-image fs-1"></i>
								</div>
							{/if}
						</div>
					</div>
				</div>
				<!-- Text column -->
				<div class="col-lg-8 col-md-12 d-flex flex-column gap-4">
					<h1 class="text-body mb-0">{titleText}</h1>
					{#if aboutHtml}
						<div class="fs-6 text-body">
							{@html aboutHtml}
						</div>
					{:else}
						<p class="text-muted">{t('page.about.empty')}</p>
					{/if}
					<hr class="border-top border-gray-500 my-0" />
					<div class="d-flex flex-column gap-2">
						<p class="fs-7 text-body-secondary mb-0">
							{t('about.created-with')}<a href="https://www.digitalbenin.org" target="_blank" class="text-body-secondary">{t('site.okpan')}</a>{t('about.tool-description')}
						</p>
						<p class="fs-7 text-body-secondary mb-0">
							{t('about.built-with')}
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
