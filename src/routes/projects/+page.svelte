<script>
    import { getContentLanguageStore } from "$lib/stores/ContentLanguageStore.svelte";
    import { getProjectStore } from "$lib/stores/ProjectStore.svelte";
    const { contentLanguageState } = getContentLanguageStore();
    const { projectState } = getProjectStore();

    $inspect("frontend languages", contentLanguageState.languages);
    $inspect("frontend projects", projectState.projects);
</script>

<h1>Projects</h1>

<div>
    {#each projectState.projects as project}
        <div>{project.title.content}</div>
    {/each}
</div>
