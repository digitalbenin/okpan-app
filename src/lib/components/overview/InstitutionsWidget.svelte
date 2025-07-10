<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import InstitutionCard from "./InstitutionCard.svelte";
  import InstitutionCardEmpty from "./InstitutionCardEmpty.svelte";
  const { t } = getTranslationStore();
  const { institutions } = $props();
</script>

<div class="bg-white rounded border d-flex flex-column p-4">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h3 class="mb-0">
      {t("common.recent-institutions", { fallback: "Recent Institutions" })}
    </h3>
    <a class="btn btn-sm btn-light" href="{page.url.pathname}/institutions"
      >{t("common.view-all", { fallback: "View all" })}</a
    >
  </div>
  {#each institutions as institution}
    <InstitutionCard {institution} />
  {/each}
  {#if institutions.length === 0}
    <InstitutionCardEmpty />
  {/if}
</div>
