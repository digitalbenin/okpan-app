<script>
  import ObjectCard from "./ObjectCard.svelte";
  import ObjectCardEmpty from "./ObjectCardEmpty.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t, translationState } = getTranslationStore();
  const { objects, title, url } = $props();

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      viewAll: t("overview.view-all-objects", { fallback: "View all objects" }),
    };
  });

  const visibleObjects = $derived(objects.slice(0, 5));
</script>

<div>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <div>{title}</div>
    <a href={url}>{i18n.viewAll}</a>
  </div>

  <div class="row row-cols-2 row-cols-lg-3 row-cols-xl-5 g-3">
    {#each visibleObjects as object, index}
      <div 
        class="col" 
        class:d-none={index >= 2} 
        class:d-lg-block={index === 2} 
        class:d-xl-block={index >= 3}
      >
        <ObjectCard {object} />
      </div>
    {/each}
    
    {#if objects.length === 0}
      <div class="col">
        <ObjectCardEmpty />
      </div>
    {/if}
  </div>
</div>
