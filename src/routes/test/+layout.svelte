<script>
  import Header from "$lib/components/Header.svelte";
  const { children } = $props();
</script>

<Header />
{@render children()}
