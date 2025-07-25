<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { addImageProtocolPrefix } from "$lib/utils/images.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";
  import { formatDate } from "$lib/utils/dates";
  import Swiper from "swiper";
  import { Navigation } from "swiper/modules";

  const { object, displayFields } = $props();
  const { t, translationState } = getTranslationStore();

  const id = $derived(getObjectIdentifier(object));

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

  const parsedFields = $derived.by(() => {
    return displayFields.result.map((field) => {
      if (field.type === "object_property") {
        return {
          label: t(`common.${field.value}`, { fallback: field.value }),
          value: formatDate(
            +object[field.value],
            translationState.currentLocale,
            true
          ),
        };
      } else if (field.type === "research_field") {
        const research_field = object.objectsResearchFields.find(
          (rf) => rf.researchField.id === field.value
        );
        if (!research_field)
          return {
            label: t(`common.field-missing`, { fallback: "Missing field" }),
            value: null,
          };
        return {
          label: research_field.researchField.name.content,
          value: research_field.vocabulary.option.content,
        };
      }
    });
  });
</script>

<div
  id="object-card-{object.id}"
  class="w-100 d-flex flex-column p-2 rounded bg-white border mb-3"
>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <BaseBadgeStatus status={object.status}></BaseBadgeStatus>
    <div><i class="bi bi-three-dots-vertical"></i></div>
  </div>
  <div class="bg-light rounded ratio ratio-1x1 mb-3">
    {#if object.objectsAssets && object.objectsAssets.length > 0}
      <div>
        <div
          class:d-none={object.objectsAssets.length === 1}
          class="position-absolute top-50 start-0 translate-middle-y z-2 ps-1"
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
          class="position-absolute top-50 end-0 translate-middle-y z-2 pe-1"
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
  <div class="fs-5 mb-2">
    <a
      href="projects/{object.project_id}/institutions/{object.institution_id}/objects/{object.id}"
      class="link-dark">{id}</a
    >
  </div>
  {#each parsedFields as field}
    <div class="mb-1">
      <div class="fs-7 text-muted">
        {field.label}
      </div>
      <div>
        {field.value}
      </div>
    </div>
  {/each}
</div>
