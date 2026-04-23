<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
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

<div class="d-flex flex-column bg-white" style="height: 100vh; overflow: hidden;">
	<!-- Topbar visible on small screens -->
	<div class="d-md-none sticky-top" style="z-index: 1020;">
		<Topbar {project} {settings} activeProjectId={data?.activeProjectId} />
	</div>
	<div class="d-flex flex-grow-1">
		<aside class="d-none d-md-block" style="z-index: 1000; position: sticky; top: 0; height: 100vh; flex-shrink: 0;">
			<Sidebar {project} {settings} activeProjectId={data?.activeProjectId} />
		</aside>
		<main class="flex-grow-1 p-3 min-w-0" style="overflow-x: auto; overflow-y: auto; height: 100vh;">
			{@render children?.()}
		</main>
	</div>
</div>
