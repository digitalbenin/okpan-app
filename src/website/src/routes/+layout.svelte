<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children, data } = $props();
	$inspect(data);
</script>

<svelte:head></svelte:head>

<div class="container-fluid">
	<div class="row">
		<div class="col-2 p-3">
			<Sidebar project={data?.project} />
		</div>
		<div class="col-10 p-3 border-start min-vh-100">
			{@render children?.()}
		</div>
	</div>
</div>
