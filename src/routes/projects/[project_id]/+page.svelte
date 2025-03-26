<script>
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
  import Table from "$lib/components/institutions/Table.svelte";
  const { data } = $props();

  $inspect("data", data);
</script>

<ProjectOverview />

<div class="container-fluid">
  <div class="row">
    <div class="col"><h2>Project Institutions</h2></div>
  </div>
  <Table institutions={data.institutions} />
</div>
