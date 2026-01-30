<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getAssetImageUrl } from "$lib/utils/media.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";
  import { formatDate } from "$lib/utils/dates";
  import Swiper from "swiper";
  import { Navigation } from "swiper/modules";

  let { object, displayFields, displayInstitution = false, selected = $bindable([]), listQuery = "" } = $props();
  
  // Selection logic
  let isSelected = $derived(selected.includes(object.id));
  
  function handleCheckboxChange(event) {
    event.stopPropagation();
    if (isSelected) {
      selected = selected.filter((id) => id !== object.id);
    } else {
      selected = [...selected, object.id];
    }
  }
  const { t, translationState } = getTranslationStore();

  const title = $derived.by(
    () =>
      (object?.name?.content && String(object.name.content).trim()) ||
      (typeof object?.name === "string" && String(object.name).trim()) ||
      getObjectIdentifier(object)
  );

  const withQuery = (url) => (listQuery ? `${url}${listQuery}` : url);

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

  const sortedAssets = $derived.by(() => {
    if (!object?.objectsAssets || object.objectsAssets.length === 0) return [];
    return [...object.objectsAssets].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  });

  const parsedFields = $derived.by(() => {
    const fields = displayFields?.result || [];
    return fields.map((field) => {
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
        const research_field = (object.objectsResearchFields || []).find(
          (rf) => rf?.researchField?.id === field.value
        );
        if (!research_field)
          return {
            label: field?.name?.content || "",
            value: null,
          };
        const value =
          research_field?.vocabulary?.option?.content ??
          research_field?.value ??
          null;
        return {
          label: field?.name?.content || "",
          value,
        };
      }
    });
  });
</script>

<div
  id="object-card-{object.id}"
  class="w-100 d-flex flex-column p-2 rounded bg-white border mb-3"
  class:border-primary={isSelected}
  class:border-2={isSelected}
>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <BaseBadgeStatus status={object.status}></BaseBadgeStatus>
    <input
      type="checkbox"
      class="form-check-input"
      checked={isSelected}
      onchange={handleCheckboxChange}
      onclick={(e) => e.stopPropagation()}
      aria-label="Select object"
    />
  </div>
  <div class="bg-light rounded ratio ratio-1x1 mb-3">
    {#if sortedAssets.length > 0}
      <div>
        <div
          class:d-none={sortedAssets.length === 1}
          class="position-absolute top-50 start-0 translate-middle-y z-2 ps-1"
        >
          <button
            class="prev btn btn-sm btn-outline-dark rounded-circle aspect-ratio-1x1"
            aria-label="previous image"><i class="bi bi-arrow-left"></i></button
          >
        </div>
        <div class="swiper w-100 h-100" {@attach attachSwiper}>
          <div class="swiper-wrapper">
            {#each sortedAssets as image, i (image.asset.id + '-' + i)}
              <div class="swiper-slide">
                <img
                  class="object-fit-contain w-100 h-100"
                  src={getAssetImageUrl(image.asset, 'md')}
                  loading="lazy"
                  alt={image.asset.id || "Object Image"}
                />
              </div>
            {/each}
          </div>
        </div>
        <div
          class:d-none={sortedAssets.length === 1}
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
      href={withQuery(`/projects/${object.project_id}/institutions/${object.institution_id}/objects/${object.id}`)}
      class="link-dark">{title}</a
    >
  </div>
  {#if displayInstitution && object?.institution?.name?.content}
    <div class="mb-1">
      <div class="text-muted fs-7">
        {t("common.institution", { fallback: "Institution" })}
      </div>
      <div class="text-truncate">
        <a
          href="/projects/{object.project_id}/institutions/{object.institution_id}"
          class="link-dark"
        >
          {object.institution.name.content}
        </a>
      </div>
    </div>
  {:else if displayInstitution}
    <div class="mb-1">
      <div class="text-muted fs-7">
        {t("common.institution", { fallback: "Institution" })}
      </div>
      <div class="text-truncate text-black-50 fst-italic">
        {t("common.no-value", { fallback: "No value" })}
      </div>
    </div>
  {/if}
  {#each parsedFields as field}
    <div class="mb-1">
      <div class="fs-7 text-muted">
        {field.label}
      </div>
      <div
        class:text-black-50={field.value === null}
        class:fst-italic={field.value === null}
      >
        {field.value || t("common.no-value", { fallback: "No value" })}
      </div>
    </div>
  {/each}
</div>
