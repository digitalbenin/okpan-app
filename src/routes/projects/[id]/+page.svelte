<script>
    import { getProjectStore } from "$lib/stores/ProjectStore.svelte";

    const { projectState } = getProjectStore();

    $inspect("projectState", projectState);
</script>

<div>
    <h1>Current Project</h1>
    <h4>{projectState.currentProject.title.content}</h4>
</div>
