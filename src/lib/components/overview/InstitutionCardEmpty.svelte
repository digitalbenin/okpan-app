<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();
</script>

<div
  class="cardInstitution d-flex bg-white border rounded-4 mb-2 p-2 gap-2 position-relative"
>
  <div
    class="imgWrapper flex-shrink-0 flex-grow-0 h-100 rounded overflow-hidden d-flex border"
  >
    <div class="col bg-light">
      <div class="d-flex align-items-center justify-content-center h-100 w-100">
        <i class="bi bi-exclamation-triangle-fill fs-3 text-secondary"></i>
      </div>
    </div>
  </div>
  <div
    class="info d-flex align-items-center justify-content-center overflow-hidden w-100"
  >
    <div class="fst-italic fs-7">
      {t("common.no-institutions", { fallback: "No institutions yet!" })}
    </div>
  </div>
  <a
    href="{page.url.pathname}/institutions"
    class="stretched-link"
    aria-label={"institutions page"}
  ></a>
</div>

<style>
  .cardInstitution {
    height: 165px;
  }

  .imgWrapper {
    aspect-ratio: 1 / 1;
  }
</style>
