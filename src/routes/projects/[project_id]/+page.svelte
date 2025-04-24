<script>
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
  import Table from "$lib/components/institutions/Table.svelte";
  import { setContext } from "svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  const { data } = $props();
  $inspect("data project", data);

  // Set project languages in context so they can be accessed by child components
  //setContext("projectLanguages", data.projectLanguages);
</script>

<ProjectOverview />

<div class="container-fluid mt-5">
  <div class="row">
    <div class="col-12">
      <div class="border-bottom d-flex align-items-center pb-2">
        <h4 class="mb-0">Institutions</h4>

        <div class="ms-auto d-flex gap-2">
          <div class="col-auto">
            <BaseInput type="text" placeholder="Search for institutions"
            ></BaseInput>
          </div>
          <BaseButton
            class="btn btn-primary"
            text="Create new Institution"
            disabled={true}
            icon="plus"
          ></BaseButton>
          <BaseButton
            class="btn btn-primary"
            text="Import data"
            disabled={true}
            icon="upload"
          ></BaseButton>
        </div>
      </div>

      <Table
        institutions={data.institutions.result}
        count={data.institutions.count}
      />
    </div>
  </div>
</div>
