<script>
  // import { queryParameters } from "sveltekit-search-params";
  // import InstitutionsTable from "$lib/components/institutions/InstitutionsTable.svelte";
  import ProjectOverview from "$lib/components/projects/ProjectOverview.svelte";

  import ObjectsWidget from "$lib/components/overview/ObjectsWidget.svelte";
  import StatsWidget from "$lib/components/overview/StatsWidget.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();

  const { data } = $props();

  // const params = queryParameters({
  //   iPage: {
  //     encode: (value) => value.toString(),
  //     decode: (value) => (value ? parseInt(value) : null),
  //     defaultValue: 1,
  //   },
  //   iPageSize: {
  //     encode: (value) => value.toString(),
  //     decode: (value) => (value ? parseInt(value) : null),
  //     defaultValue: 3,
  //   },
  //   iOrderBy: {
  //     encode: (value) => value,
  //     decode: (value) => value,
  //     defaultValue: "name",
  //   },
  //   iDirection: {
  //     encode: (value) => value,
  //     decode: (value) => value,
  //     defaultValue: "asc",
  //   },
  // });

  $inspect(data.project);
  const stats = $derived([
    {
      label: t("common.objects", { fallback: "Objects" }),
      value: data.project.objectsCount,
      percentage: data.project.completedObjectsCount,
      labelPercentage: t("common.objects-percentage", {
        fallback: "of objects completed",
      }),
    },
    {
      label: t("commo.assets", { fallback: "Assets" }),
      value: data.project.assetsCount,
      percentage: data.project.linkedAssetsCount,
      labelPercentage: t("common.assets-percentage", {
        fallback: "of assets linked to objects",
      }),
    },
    {
      label: t("common.institutions", { fallback: "Institutions" }),
      value: data.institutions.count,
    },
  ]);
</script>

<div class="container-fluid bg-light">
  <div class="row justify-content-center">
    <div class="col-auto">search</div>
  </div>

  <div class="row">
    <div class="col-9">
      <ObjectsWidget
        objectsEdited={data.objects.items}
        objectsInProgress={data.objectsInProgress.items}
      />
    </div>
    <div class="col-3"><StatsWidget {stats} /></div>
  </div>
  <div class="row">
    <div class="col-5">
      {#each data.institutions.result as institution}
        <a href={`/projects/${data.project.id}/institutions/${institution.id}`}
          >{institution.name.content}</a
        >
      {/each}
    </div>
    <div class="col-7">actions</div>
  </div>
</div>

<ProjectOverview />
<!-- 
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
              bind:value={params.iSearch}
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
        <InstitutionsTable
          institutions={data.institutions.result}
          count={data.institutions.count || 0}
        />
      {/if}
    </div>
  </div>
</div> -->
