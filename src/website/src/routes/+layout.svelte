<script>
	import '../assets/main.scss';
	import 'bootstrap-icons/font/bootstrap-icons.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();
	$inspect(data);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children?.()}
