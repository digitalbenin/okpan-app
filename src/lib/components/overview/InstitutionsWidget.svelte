<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionGridCard from "./InstitutionGridCard.svelte";
  import InstitutionCardEmpty from "./InstitutionCardEmpty.svelte";
  const { t } = getTranslationStore();
  const { institutions } = $props();

  const visibleInstitutions = $derived(institutions.slice(0, 3));
</script>

<div class=" rounded-5">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <div>{t("common.recent-institutions", { fallback: "Recent Institutions" })}</div>
    <a class="fs-7" href="{page.url.pathname}/institutions">{t("overview.view-all-institutions", { fallback: "View all institutions" })}</a>
  </div>
  <div class="row row-cols-1 row-cols-lg-2 row-cols-xl-3 g-3">
    {#each visibleInstitutions as institution, index}
      <div
        class="col"
        class:d-none={index >= 1}
        class:d-lg-block={index === 1}
        class:d-xl-block={index >= 2}
      >
        <InstitutionGridCard {institution} />
      </div>
    {/each}

    {#if institutions.length === 0}
      <div class="col">
        <InstitutionCardEmpty />
      </div>
    {/if}
  </div>
</div>
