<script>
  import ProjectHeader from "$lib/components/projects/ProjectHeader.svelte";
  let { children, data } = $props();
</script>

<ProjectHeader />

{@render children()}
