<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionCard from "./InstitutionCard.svelte";
  import InstitutionCardEmpty from "./InstitutionCardEmpty.svelte";
  const { t, translationState } = getTranslationStore();
  const { institutions } = $props();

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      recentInstitutions: t("common.recent-institutions", {
        fallback: "Recent Institutions",
      }),
      viewAll: t("common.view-all", { fallback: "View all" }),
    };
  });
</script>

<div class="bg-white rounded border d-flex flex-column p-4">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h3 class="mb-0">
      {i18n.recentInstitutions}
    </h3>
    <a class="btn btn-sm btn-light" href="{page.url.pathname}/institutions"
      >{i18n.viewAll}</a
    >
  </div>
  {#each institutions as institution}
    <InstitutionCard {institution} />
  {/each}
  {#if institutions.length === 0}
    <InstitutionCardEmpty />
  {/if}
</div>
