<script>
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";
  import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";

  let { data } = $props();
  // $inspect("frontend languages", data.languages);
  $inspect("frontend projects", data.projects);
  // $inspect("frontend current project", data.currentProject);
</script>

<div class="container-fluid h-100">
  <div class="row h-100">
    <div class="col-3 p-0">
      <ProjectsList projects={data.projects} />
    </div>
    <div class="col-9 p-0">
      <!-- <ProjectCreate /> -->
    </div>
  </div>
</div>
