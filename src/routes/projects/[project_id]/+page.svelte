<script>
  import ObjectsWidget from "$lib/components/overview/ObjectsWidget.svelte";
  import StatsWidget from "$lib/components/overview/StatsWidget.svelte";
  import InstitutionsWidget from "$lib/components/overview/InstitutionsWidget.svelte";
  import RecentActivityWidget from "$lib/components/overview/RecentActivityWidget.svelte";
  import ProjectWelcome from "$lib/components/projects/ProjectWelcome.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { onMount } from "svelte";
  import { invalidate } from "$app/navigation";
  import { IconBox, IconPhoto, IconChartCircles, IconBuildingBank } from "@tabler/icons-svelte";

  const { t, translationState } = getTranslationStore();
  const { data } = $props();

  const connectionTypesCount = $derived(
    (data.researchFields?.result || data.researchFields || []).filter((rf) => rf.type === "vocabulary").length
  );

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      overview: t("menu.overview", { fallback: "Overview" }),
      objects: t("common.objects", { fallback: "Objects" }),
      mediaFiles: t("common.media-files", { fallback: "Media files" }),
      institutions: t("common.institutions", { fallback: "Institutions" }),
      relations: t("common.relations", { fallback: "Relations" }),
      objectsPercentage: t("common.objects-percentage", { fallback: "marked as complete" }),
      assetsPercentage: t("common.assets-percentage", { fallback: "assets linked to objects" }),
      assetsAllLinked: t("overview.assets-all-linked", { fallback: "All linked to objects" }),
    };
  });

  const stats = $derived([
    {
      label: i18n.objects,
      value: data.project.objectsCount,
      percentage: data.project.completedObjectsCount,
      labelPercentage: i18n.objectsPercentage,
      icon: IconBox,
      iconBgClass: "bg-purple-100",
      iconColorClass: "text-purple-400",
    },
    {
      label: i18n.mediaFiles,
      value: data.project.assetsCount,
      percentage: data.project.linkedAssetsCount,
      labelPercentage: i18n.assetsPercentage,
      labelComplete: i18n.assetsAllLinked,
      icon: IconPhoto,
      iconBgClass: "bg-pink-100",
      iconColorClass: "text-pink-400",
    },
    {
      label: i18n.institutions,
      value: data.project.institutionsCount,
      icon: IconBuildingBank,
      iconBgClass: "bg-blue-100",
      iconColorClass: "text-blue-400",
    },
    {
      label: i18n.relations,
      value: connectionTypesCount,
      icon: IconChartCircles,
      iconBgClass: "bg-orange-100",
      iconColorClass: "text-orange-400",
    },
  ]);

  onMount(() => {
    if (!window.api?.onDataChanged) {
      return;
    }

    const unsubscribe = window.api.onDataChanged((payload) => {
      if (payload?.projectId && String(payload.projectId) !== String(data.project?.id)) {
        return;
      }

      // Remote changes handled by global listener.
      // Homepage listener handles LOCAL changes only.
      if (payload?.origin && payload.origin !== "local") {
        return;
      }

      invalidate("app:project-shared");
    });

    return unsubscribe;
  });
</script>

{#if (data.objects?.totalCount ?? 0) === 0}
  <ProjectWelcome institutionsCount={data.project.institutionsCount ?? 0} />
{:else}
  <div class="min-vh-100 d-flex flex-column gap-4">
    <div class="d-flex flex-column gap-2">
      <div>{i18n.overview}</div>
      <StatsWidget {stats} />
    </div>

    <div class="d-flex gap-3 align-items-start">
      <div class="flex-grow-1 d-flex flex-column gap-5 min-w-0">
        <ObjectsWidget objects={data.objects.items} />
        <InstitutionsWidget institutions={data.institutions.result} />
      </div>
      <div class="flex-shrink-0" style="width: 277px;">
        <RecentActivityWidget activities={data.activities.items} />
      </div>
    </div>
  </div>
{/if}
