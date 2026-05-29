<script>
  import Header from "$lib/components/test/Header.svelte";
  const { children } = $props();
</script>

<Header />
{@render children()}
