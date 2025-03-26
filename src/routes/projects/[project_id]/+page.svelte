<script>
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
  import Table from "$lib/components/institutions/Table.svelte";
  const { data } = $props();
</script>

<ProjectOverview />

<div class="container-fluid mt-2">
  <div class="row">
    <div class="col-12"><h3>Institutions</h3></div>
  </div>
  <Table institutions={data.institutions} />
</div>
