<script>
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
  import Table from "$lib/components/institutions/Table.svelte";
  const { data } = $props();
  $inspect("data project", data);
</script>

<ProjectOverview />

<div class="container-fluid mt-2">
  <div class="row">
    <div class="col-12"><h3>Institutions</h3></div>
  </div>
  <Table
    institutions={data.institutions.result}
    count={data.institutions.count}
  />
</div>
