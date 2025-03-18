<script>
    import { goto } from "$app/navigation";
    import BaseInput from "$lib/components/base/BaseInput.svelte";
    import BaseButton from "../base/BaseButton.svelte";
    import { epochToDate } from "$lib/utils/dates";

    let { projects } = $props();

    const gotoProject = (projectId) => {
        console.log("gotoProject", projectId);
        goto(`/projects/${projectId}`);
    };

    let search = $state("");

    const filteredProjects = $derived(
        projects.filter(
            (project) =>
                project.title.content
                    .toLowerCase()
                    .includes(search.toLowerCase()) ||
                project.description.content
                    .toLowerCase()
                    .includes(search.toLowerCase()),
        ),
    );
</script>

<div class="d-flex flex-column gap-0 bg-light p-4 vh-100">
    <h1 class="fs-4">Open project</h1>
    <BaseInput bind:value={search} placeholder="Search" class="mb-4" />
    {#each filteredProjects as project}
        <div class="d-flex align-items-start gap-2">
            <BaseButton
                onClick={() => gotoProject(project.id)}
                icon="files"
                class="border-0 bg-primary-subtle text-primary-emphasis w-auto p-2 my-0"
            ></BaseButton>
            <div class="d-flex flex-column align-items-start p-0">
                <BaseButton
                    onClick={() => gotoProject(project.id)}
                    text={project.title.content}
                    class="btn btn-link p-0 text-capitalize fs-7"
                ></BaseButton>
                <p class="fs-7">
                    Created on {epochToDate(project.created_at)}
                </p>
            </div>
        </div>
    {/each}
</div>

<style>
    :global(.fs-7) {
        font-size: 0.875rem;
    }
</style>
