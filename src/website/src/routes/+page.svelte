<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>
<button class="btn btn-primary" type="button">Primary Button</button>

<script>
	$effect(() => {
		async function loadData() {
			try {
				// The +server.js is in the same route directory, so a fetch to the current path will hit it.
				const response = await fetch('./');
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				console.log('Search results:', data);
			} catch (error) {
				console.error('Failed to fetch search results:', error);
			}
		}

		loadData();
	});
</script>
