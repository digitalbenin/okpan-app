<script>
	let { data } = $props();

	console.log('Data received in +page.svelte:', data);

	// For debugging, you can inspect the data from the load function.
	$inspect(data);
</script>
