<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';
	import { onMount } from 'svelte';

	let { children, data } = $props();
	
	// For static export: load project/settings client-side from site.json (small file)
	let project = $state(data?.project);
	let settings = $state(data?.settings);
	
	onMount(async () => {
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

<div class="container-fluid">
	<!-- Topbar visible on small screens -->
	<div class="d-md-none">
		<Topbar {project} {settings} />
	</div>
	<div class="row">
		<aside class="col-md-2 d-none d-md-block p-3">
			<Sidebar {project} {settings} />
		</aside>
		<main class="col-12 col-md-10 p-3 border-start min-vh-100">
			{@render children?.()}
		</main>
	</div>
</div>
