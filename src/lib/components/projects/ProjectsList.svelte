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
        project.title.content.toLowerCase().includes(search.toLowerCase()) ||
        project.description.content.toLowerCase().includes(search.toLowerCase())
    )
  );
</script>

<div class="p-3">
  <h1 class="fs-4">Open project</h1>
  <BaseInput bind:value={search} placeholder="Search" class="mb-4" />
  <div class="d-flex flex-column">
    {#each filteredProjects as project}
      <div class="d-flex gap-2">
        <div
          class="bg-primary-subtle px-3 d-flex align-items-center justify-content-center"
        >
          <i class="bi bi-files"></i>
        </div>

        <div class="d-flex flex-column">
          <a href="/projects/{project.id}">
            {project.title.content}
          </a>
          <p class="fs-7 mb-0">
            Created on {epochToDate(project.created_at)}
          </p>
        </div>
      </div>
    {/each}
    {#if filteredProjects.length === 0}
      <p>No projects found</p>
    {/if}
  </div>
</div>
