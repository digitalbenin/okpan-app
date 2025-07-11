<script>
  // import { queryParameters } from "sveltekit-search-params";
  // import InstitutionsTable from "$lib/components/institutions/InstitutionsTable.svelte";
  import ObjectsWidget from "$lib/components/overview/ObjectsWidget.svelte";
  import StatsWidget from "$lib/components/overview/StatsWidget.svelte";
  import InstitutionsWidget from "$lib/components/overview/InstitutionsWidget.svelte";
  import ActionsWidget from "$lib/components/overview/ActionsWidget.svelte";
  import SearchWidget from "$lib/components/overview/SearchWidget.svelte";
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

  //TODO: in the api response, put alla stats in a single object and pass directly to the StatsWidget
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

<div class="wrapper container-fluid bg-light pb-3">
  <div class="row">
    <div class="col-7">
      <div class="my-3">
        <SearchWidget projectId={data.project.id} />
      </div>
    </div>
  </div>

  <div class="row mb-3">
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
      <InstitutionsWidget institutions={data.institutions.result} />
    </div>
    <div class="col-7">
      <ActionsWidget actions={data.actions.items} />
    </div>
  </div>
</div>

<style>
  .wrapper {
    min-height: 100%;
  }
</style>
