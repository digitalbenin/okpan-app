<script>
    import { getProjectStore } from "$lib/stores/ProjectStore.svelte";
    import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
    const { projectState } = getProjectStore();

    $inspect("projectState", projectState);
</script>

<ProjectOverview />
