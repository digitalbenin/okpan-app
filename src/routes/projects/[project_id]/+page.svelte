<script>
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
  import Table from "$lib/components/institutions/Table.svelte";
  import { setContext } from "svelte";

  const { data } = $props();
  $inspect("data project", data);

  // Set project languages in context so they can be accessed by child components
  //setContext("projectLanguages", data.projectLanguages);
</script>

<ProjectOverview />

<div class="container-fluid mt-5">
  <div class="row">
    <div class="col-12"><h4>Institutions</h4></div>
  </div>
  <Table
    institutions={data.institutions.result}
    count={data.institutions.count}
  />
</div>
