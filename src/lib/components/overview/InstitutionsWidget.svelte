<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionGridCard from "./InstitutionGridCard.svelte";
  import InstitutionCardEmpty from "./InstitutionCardEmpty.svelte";
  const { t } = getTranslationStore();
  const { institutions } = $props();
</script>

<div class=" rounded-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>{t("common.recent-institutions", { fallback: "Recent Institutions" })}</div>
    <a class="fs-7" href="{page.url.pathname}/institutions">{t("overview.view-all-institutions", { fallback: "View all institutions" })}</a>
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
