<script>
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte";
    import { getProjectStore } from "$lib/stores/ProjectStore.svelte";
    const { contentLanguageState } = getContentLanguageStore();
    const { projectState, setProject } = getProjectStore();

    $inspect("frontend languages", contentLanguageState.languages);
    $inspect("frontend projects", projectState.projects);
    $inspect("frontend current project", projectState.currentProject);
</script>

<h1>Projects</h1>

<div>
    {#each projectState.projects as project}
        <button onclick={() => setProject(project.id)}
            >{project.title.content}</button
        >
    {/each}
</div>

<div>
    {#if projectState.currentProject}
        <h2>{projectState.currentProject?.title?.content}</h2>
        <p>{projectState.currentProject?.description?.content}</p>
    {/if}
</div>
