<script>
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
  import Table from "$lib/components/institutions/Table.svelte";
  const { data } = $props();
  $inspect("data project", data);
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
