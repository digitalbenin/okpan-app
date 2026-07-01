<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import Topbar from '$lib/components/Topbar.svelte';
	import { getWebsiteTranslationStore } from '$lib/stores/WebsiteTranslationStore.svelte.js';
	import { getWebsiteContentStore } from '$lib/stores/WebsiteContentStore.svelte.js';
	import { onMount } from 'svelte';
	import { resolveSitePath } from '$lib/utils/sitePaths.js';

	let { children, data } = $props();
	const { setLocale } = getWebsiteTranslationStore();
	const { initialize } = getWebsiteContentStore();
	
	// Static export can override loader data after fetching site.json.
	let staticProject = $state(null);
	let staticSettings = $state(null);
	const project = $derived.by(() => staticProject || data?.project || {});
	const settings = $derived.by(() => staticSettings || data?.settings || {});

	initialize({
		languages: data?.content_languages || [],
		defaultLocale: data?.default_content_locale || ''
	});

	if (data?.locale) {
		setLocale(data.locale);
	}
	
	onMount(async () => {
		if (data?.needsClientLoad) {
			try {
				const response = await fetch(resolveSitePath('site.json'));
				const json = await response.json();
				staticProject = json.project || {};
				staticSettings = json.settings || {};
				initialize({
					languages: json.content_languages || [],
					defaultLocale: json.default_content_locale || ''
				});

				if (json.locale) {
					setLocale(json.locale);
				}
			} catch (e) {
				console.warn('Could not load site data:', e);
			}
		}
	});
</script>

<div class="d-flex flex-column bg- bg-gray-200 min-vh-100 m-0 p-0" style="overflow: hidden;">
	<Topbar {project} {settings} activeProjectId={data?.activeProjectId} />
	<main class="flex-grow-1 min-w-0 p-0 m-0 pt-5" style="overflow-x: auto; overflow-y: auto;">
		{@render children?.()}
	</main>
</div>
