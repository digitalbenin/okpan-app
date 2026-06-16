<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();
</script>

<div class="card-object position-relative d-flex border rounded p-1 gap-2">
  <div
    class="img-wrapper bg-light rounded overflow-hidden flex-grow-0 flex-shrink-0"
  >
    <div class="d-flex align-items-center justify-content-center h-100 w-100">
      <i class="bi bi-exclamation-triangle-fill fs-3 text-secondary"></i>
    </div>
  </div>
  <div class="info d-flex align-items-center justify-content-center">
    <div class="fst-italic fs-7">
      {t("common.no-objects", { fallback: "No objects yet!" })}
    </div>
  </div>
  <a
    href="{page.url.pathname}/objects"
    class="stretched-link"
    aria-label={"objects page"}
  ></a>
</div>

<style>
  .card-object {
    flex: 0 0 auto;
    width: 260px;
    scroll-snap-align: start;
  }

  .img-wrapper {
    height: 120px;
    width: 120px;
  }

  .info {
    min-width: 0;
  }
</style>
