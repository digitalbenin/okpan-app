<script>
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";
  import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";

  const { data } = $props();
</script>

<div class="d-flex w-100 h-100">
  <div class="sidebar bg-light">
    <ProjectsList projects={data.projects} />
  </div>
  <div class="col">
    <ProjectCreate />
  </div>
</div>

<style>
  .sidebar {
    flex: 0 0 360px;
    max-width: 360px;
  }
</style>
