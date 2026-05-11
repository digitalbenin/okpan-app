<script>
  // import { queryParameters } from "sveltekit-search-params";
  // import InstitutionsTable from "$lib/components/institutions/InstitutionsTable.svelte";
  import ObjectsWidget from "$lib/components/overview/ObjectsWidget.svelte";
  import StatsWidget from "$lib/components/overview/StatsWidget.svelte";
  import InstitutionsWidget from "$lib/components/overview/InstitutionsWidget.svelte";
  import RecentActivityWidget from "$lib/components/overview/RecentActivityWidget.svelte";
  import SearchWidget from "$lib/components/overview/SearchWidget.svelte";
  import ProjectWelcome from "$lib/components/projects/ProjectWelcome.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t, translationState } = getTranslationStore();
  const { data } = $props();

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      objects: t("common.objects", { fallback: "Objects" }),
      assets: t("common.assets", { fallback: "Assets" }),
      institutions: t("common.institutions", { fallback: "Institutions" }),
      objectsPercentage: t("common.objects-percentage", {
        fallback: "of objects completed",
      }),
      assetsPercentage: t("common.assets-percentage", {
        fallback: "of assets linked to objects",
      }),
    };
  });

  //TODO: in the api response, put alla stats in a single object and pass directly to the StatsWidget
  const stats = $derived([
    {
      label: i18n.objects,
      value: data.project.objectsCount,
      percentage: data.project.completedObjectsCount,
      labelPercentage: i18n.objectsPercentage,
    },
    {
      label: i18n.assets,
      value: data.project.assetsCount,
      percentage: data.project.linkedAssetsCount,
      labelPercentage: i18n.assetsPercentage,
    },
    {
      label: i18n.institutions,
      value: data.institutions?.count,
    },
  ]);
</script>

{#if (data.objects?.totalCount ?? 0) === 0}
  <ProjectWelcome institutionsCount={data.institutions?.count ?? 0} />
{:else}
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
        <RecentActivityWidget activities={data.activities.items} />
      </div>
    </div>
  </div>
{/if}

<style>
  .wrapper {
    min-height: 100%;
  }
</style>
