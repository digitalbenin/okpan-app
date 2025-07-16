<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { addImageProtocolPrefix } from "$lib/utils/images.js";
  import { formatDate } from "$lib/utils/dates";
  import Swiper from "swiper";
  import { Navigation } from "swiper/modules";
  import "swiper/css";

  const { object } = $props();
  const { t, translationState } = getTranslationStore();

  const attachSwiper = (element) => {
    const swiperInstance = new Swiper(element, {
      slidesPerView: 1,
      spaceBetween: 10,
      loop: true,
      modules: [Navigation],
      navigation: {
        nextEl: `#object-card-${object.id} .next`,
        prevEl: `#object-card-${object.id} .prev`,
      },
    });

    return () => {
      swiperInstance.destroy();
    };
  };
  $inspect(object); // Debugging: inspect object data
</script>

<div
  id="object-card-{object.id}"
  class="w-100 d-flex flex-column p-2 rounded bg-white border mb-3"
>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <BaseBadgeStatus status={object.status}></BaseBadgeStatus>
    <div><i class="bi bi-three-dots-vertical"></i></div>
  </div>
  <div class="bg-light rounded ratio ratio-1x1 mb-2">
    {#if object.objectsAssets && object.objectsAssets.length > 0}
      <div>
        <div
          class:d-none={object.objectsAssets.length === 1}
          class="position-absolute top-50 start-0 translate-middle-y z-2"
        >
          <button
            class="prev btn btn-sm btn-outline-dark rounded-circle aspect-ratio-1x1"
            aria-label="previous image"><i class="bi bi-arrow-left"></i></button
          >
        </div>
        <div class="swiper w-100 h-100" {@attach attachSwiper}>
          <div class="swiper-wrapper">
            {#each object.objectsAssets as image (image.asset.id)}
              <div class="swiper-slide">
                <img
                  class="object-fit-contain w-100 h-100"
                  src={addImageProtocolPrefix(image.asset.formats.md)}
                  loading="lazy"
                  alt={image.asset.id || "Object Image"}
                />
              </div>
            {/each}
          </div>
        </div>
        <div
          class:d-none={object.objectsAssets.length === 1}
          class="position-absolute top-50 end-0 translate-middle-y z-2"
        >
          <button
            class="next btn btn-sm btn-outline-dark rounded-circle aspect-ratio-1x1"
            aria-label="next image"><i class="bi bi-arrow-right"></i></button
          >
        </div>
      </div>
    {:else}
      <div class="d-flex align-items-center justify-content-center h-100 w-100">
        <i class="bi bi-image fs-1 text-secondary"></i>
      </div>
    {/if}
  </div>
  <div>
    <div class="fs-7 text-muted">
      {t("common.latest-update", { fallback: "Latest Update" })}
    </div>
    <div>
      {formatDate(+object.updated_at, translationState.currentLocale, true)}
    </div>
  </div>
</div>
