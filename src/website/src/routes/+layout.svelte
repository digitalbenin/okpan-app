<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import { onMount } from 'svelte';
	import { currentProjectId } from '$lib/stores/project.js';

	let { children, data } = $props();
	
	// For static export: load project/settings client-side from site.json (small file)
	let project = $state(data?.project);
	let settings = $state(data?.settings);
	
	onMount(async () => {
		// Initialise the projectId store from layout data (preview mode)
		if (data?.projectId) {
			currentProjectId.set(data.projectId);
		}

		if (data?.needsClientLoad) {
			try {
				const response = await fetch('/site.json');
				const json = await response.json();
				project = json.project || {};
				settings = json.settings || {};
			} catch (e) {
				console.warn('Could not load site data:', e);
			}
		}
	});
</script>

<div class="d-flex flex-column bg-white" style="height: 100vh; overflow: hidden;">
	<!-- Topbar visible on small screens -->
	<div class="d-md-none sticky-top" style="z-index: 1020;">
		<Topbar {project} {settings} />
	</div>
	<div class="d-flex flex-grow-1">
		<aside class="d-none d-md-block" style="z-index: 1000; position: sticky; top: 0; height: 100vh; flex-shrink: 0;">
			<Sidebar {project} {settings} />
		</aside>
		<main class="flex-grow-1 p-3 min-w-0" style="overflow-x: auto; overflow-y: auto; height: 100vh;">
			{@render children?.()}
		</main>
	</div>
</div>
