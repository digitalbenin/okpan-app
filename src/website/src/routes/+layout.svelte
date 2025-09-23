<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';

	let { children, data } = $props();
	$inspect(data);
</script>

<svelte:head></svelte:head>

{@render children?.()}
