<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Topbar from '$lib/components/Topbar.svelte';

	let { children, data } = $props();
	$inspect('settings', data);
</script>

<svelte:head></svelte:head>

<div class="container-fluid">
	<!-- Topbar visible on small screens -->
	<div class="d-md-none">
		<Topbar project={data?.project} settings={data?.settings} />
	</div>
	<div class="row">
		<aside class="col-md-2 d-none d-md-block p-3">
			<Sidebar project={data?.project} settings={data?.settings} />
		</aside>
		<main class="col-12 col-md-10 p-3 border-start min-vh-100">
			{@render children?.()}
		</main>
	</div>
</div>
