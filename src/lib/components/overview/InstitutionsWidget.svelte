<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionGridCard from "./InstitutionGridCard.svelte";
  import InstitutionCardEmpty from "./InstitutionCardEmpty.svelte";
  const { t, translationState } = getTranslationStore();
  const { institutions } = $props();

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      recentInstitutions: t("common.recent-institutions", { fallback: "Recent Institutions" }),
      viewAll: t("overview.view-all-institutions", { fallback: "View all institutions" }),
    };
  });
</script>

<div class=" rounded-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>{i18n.recentInstitutions}</div>
    <a href="{page.url.pathname}/institutions">{i18n.viewAll}</a>
  </div>
  {#if institutions.length === 0}
    <InstitutionCardEmpty />
  {:else}
    <div class="row row-cols-3 g-3">
      {#each institutions.slice(0, 3) as institution}
        <div class="col">
          <InstitutionGridCard {institution} />
        </div>
      {/each}
    </div>
  {/if}
</div>
