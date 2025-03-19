<script>
    import ProjectHeader from "$lib/components/projects/ProjectHeader.svelte";
    let { children } = $props();
</script>

<ProjectHeader />

{@render children()}
