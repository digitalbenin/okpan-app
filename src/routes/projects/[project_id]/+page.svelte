<script>
  import { queryParameters } from "sveltekit-search-params";
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";
  import Table from "$lib/components/institutions/Table.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  const { data } = $props();

  const params = queryParameters({
    page: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 1,
    },
    ["page-size"]: {
      encode: (value) => value.toString(),
      decode: (value) => (value ? parseInt(value) : null),
      defaultValue: 3,
    },
    orderBy: {
      encode: (value) => value,
      decode: (value) => value,
      defaultValue: "name",
    },
    direction: {
      encode: (value) => value,
      decode: (value) => value,
      defaultValue: "asc",
    },
  });
</script>

<ProjectOverview />

<div class="container-fluid mt-5">
  <div class="row">
    <div class="col-12">
      <div class="border-bottom d-flex align-items-center pb-2">
        <h4 class="mb-0">Institutions</h4>

        <div class="ms-auto d-flex gap-2">
          <div class="col-auto">
            <BaseInput
              type="text"
              placeholder="Search for institutions"
              bind:value={params.search}
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
      {#if data.institutions && data.institutions.count > 0}
        <Table
          institutions={data.institutions.result}
          count={data.institutions.count || 0}
        />
      {/if}
    </div>
  </div>
</div>
