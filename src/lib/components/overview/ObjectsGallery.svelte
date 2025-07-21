<script>
  import ObjectCard from "./ObjectCard.svelte";
  import ObjectCardEmpty from "./ObjectCardEmpty.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();
  const { objects, title, url } = $props();
</script>

<div>
  <div class="d-flex justify-content-between px-3 align-items-center mb-2">
    <div>{title}</div>
    <div>
      <a class="btn btn-sm btn-light" href={url}
        >{t("common.view-all", { fallback: "View all" })}</a
      >
    </div>
  </div>

  <div class="wrapper position-relative">
    <div class="gallery d-flex flex-nowrap gap-3 overflow-scroll w-100">
      {#each objects as object}
        <ObjectCard {object}></ObjectCard>
      {/each}
      {#if objects.length === 0}
        <ObjectCardEmpty></ObjectCardEmpty>
      {/if}
    </div>
  </div>
</div>

<style>
  .wrapper::before,
  .wrapper::after {
    content: "";
    position: absolute;
    top: 0;
    width: 1rem;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }

  .wrapper::before {
    left: 0;
    background: linear-gradient(
      to right,
      rgba(var(--bs-body-bg-rgb), 1),
      rgba(var(--bs-body-bg-rgb), 0)
    );
  }

  .wrapper::after {
    right: 0;
    background: linear-gradient(
      to left,
      rgba(var(--bs-body-bg-rgb), 1),
      rgba(var(--bs-body-bg-rgb), 0)
    );
  }

  .gallery {
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    scroll-padding-inline-start: 0.75rem;
    scroll-padding-inline-end: 0.75rem;
    padding: 0 0.75rem;
  }

  .gallery::-webkit-scrollbar {
    display: none;
  }
</style>
