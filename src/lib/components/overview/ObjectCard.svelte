<script>
  import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";
  import imgLg from "$assets/img_lg.png";
  import Swiper from "swiper";
  import { Navigation } from "swiper/modules";
  import { IconChevronLeft, IconChevronRight } from "@tabler/icons-svelte";

  let { object, displayFields, displayInstitution = false, selected = $bindable([]), listQuery = "" } = $props();

  const { t, translationState } = getTranslationStore();

  const institution = $derived(object.institution?.name.content);
  const title = $derived.by(
    () =>
      (object?.name?.content && String(object.name.content).trim()) ||
      (typeof object?.name === "string" && String(object.name).trim()) ||
      getObjectIdentifier(object)
  );

  const sortedAssets = $derived.by(() => {
    if (!object?.objectsAssets || object.objectsAssets.length === 0) return [];
    return [...object.objectsAssets]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((oa) => oa?.asset)
      .filter(Boolean);
  });

  const attachSwiper = (element) => {
    const swiperInstance = new Swiper(element, {
      slidesPerView: 1,
      spaceBetween: 0,
      loop: sortedAssets.length > 1,
      modules: [Navigation],
      navigation: {
        nextEl: element.parentElement.querySelector('.next'),
        prevEl: element.parentElement.querySelector('.prev'),
      },
    });

    return () => {
      swiperInstance.destroy();
    };
  };

  const withQuery = (url) => (listQuery ? `${url}${listQuery}` : url);

  const isSelectable = $derived(displayFields !== undefined);
  let isSelected = $derived(isSelectable && selected.includes(object.id));

  function handleCheckboxChange(event) {
    event.stopPropagation();
    if (isSelected) {
      selected = selected.filter((id) => id !== object.id);
    } else {
      selected = [...selected, object.id];
    }
  }

  const parsedFields = $derived.by(() => {
    const fields = displayFields || [];
    return fields.map((field) => {
      if (field.type === "object_property") {
        return {
          label: t(`common.${field.value}`, { fallback: field.value }),
          value: formatDate(+object[field.value], translationState.currentLocale, true),
        };
      } else if (field.type === "research_field") {
        const research_field = (object.objectsResearchFields || []).find(
          (rf) => rf?.researchField?.id === field.value
        );
        if (!research_field) return { label: field?.name?.content || "", value: null };
        const value = research_field?.vocabulary?.option?.content ?? research_field?.value ?? null;
        return { label: field?.name?.content || "", value };
      }
    });
  });
</script>

<div
  class="card-object position-relative bg-white border rounded-4 overflow-hidden d-flex flex-column pb-2"
  class:border-primary={isSelected}
  class:border-2={isSelected}
>
  <div class="bg-light overflow-hidden position-relative" style="aspect-ratio: 1;">
    {#if sortedAssets.length > 0}
      <div class="h-100 w-100">
        {#if sortedAssets.length > 1}
          <div class="position-absolute top-50 start-0 translate-middle-y z-2 ps-1">
            <button
              class="prev d-flex align-items-center justify-content-center btn btn-light btn-sm p-0 rounded-circle border-0 opacity-75 flex-shrink-0"
              style="width: 24px; height: 24px;"
              aria-label={t("objects.previous-image", { fallback: "Previous image" })}
            >
              <IconChevronLeft size={14} />
            </button>
          </div>
        {/if}
        <div class="swiper w-100 h-100" {@attach attachSwiper}>
          <div class="swiper-wrapper">
            {#each sortedAssets as asset, i (asset.id + '-' + i)}
              <div class="swiper-slide">
                <BaseImage
                  class="w-100 h-100"
                  objectFit="cover"
                  {asset}
                  preferredFormat="sm"
                  loading="lazy"
                  alt={title || ""}
                />
              </div>
            {/each}
          </div>
        </div>
        {#if sortedAssets.length > 1}
          <div class="position-absolute top-50 end-0 translate-middle-y z-2 pe-1">
            <button
              class="next d-flex align-items-center justify-content-center btn btn-light btn-sm p-0 rounded-circle border-0 opacity-75 flex-shrink-0"
              style="width: 24px; height: 24px;"
              aria-label={t("objects.next-image", { fallback: "Next image" })}
            >
              <IconChevronRight size={14} />
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <img src={imgLg} alt="" class="w-100 h-100" style="object-fit: cover;" />
    {/if}
  </div>

  {#if isSelectable}
    <div class="position-absolute top-0 end-0 m-2" style="z-index: 1">
      <input
        type="checkbox"
        class="form-check-input"
        style="border: 1px solid var(--bs-gray-800);"
        checked={isSelected}
        onchange={handleCheckboxChange}
        onclick={(e) => e.stopPropagation()}
        aria-label={t("objects.select-object", { fallback: "Select object" })}
      />
    </div>
  {/if}

  <div class="px-3 pt-2 pb-2 d-flex flex-column gap-1">
    {#if isSelectable}
      <a
        href={withQuery(`/projects/${object.project_id}/institutions/${object.institution_id}/objects/${object.id}`)}
        class="fw-semibold text-truncate link-dark text-decoration-none fs-7"
      >{title}</a>
    {:else}
      <div class="fw-semibold text-truncate fs-7">{title}</div>
    {/if}
    {#if institution}
      <div class="text-body-secondary text-truncate fs-7">{institution}</div>
    {/if}
    <BaseBadgeStatus status={object.status} />
  </div>

  {#each parsedFields as field}
    <div class="px-3 mb-1">
      <div class="fs-7 text-muted">{field.label}</div>
      <div class="fs-7" class:text-black-50={field.value === null} class:fst-italic={field.value === null}>
        {field.value || t("common.no-value", { fallback: "No value" })}
      </div>
    </div>
  {/each}

  {#if !isSelectable}
    <a
      href="/projects/{object.project_id}/institutions/{object.institution_id}/objects/{object.id}"
      class="stretched-link"
      aria-label={title}
    ></a>
  {/if}
</div>

<style>
  .card-object {
    scroll-snap-align: start;
  }
</style>
