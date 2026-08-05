<script>
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import { IconMapPin, IconBox, IconPhoto } from "@tabler/icons-svelte";
  import imgSm from "$assets/img_sm.png";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();

  let { institution } = $props();
</script>

<div
  class="w-100 h-100 position-relative d-flex flex-column rounded-4 overflow-hidden bg-white border"
>
  <div class="w-100 flex-shrink-0 d-flex" style="height: 196px;">
    {#if institution.previewImages && institution.previewImages.length > 0}
      <div class="flex-grow-1 h-100">
        <BaseImage
          class="w-100 h-100"
          objectFit="cover"
          asset={institution.previewImages[0]}
          preferredFormat="sm"
          compact={true}
          alt={institution.name.content || t("common.institution", { fallback: "Institution" })}
        />
      </div>
      {#if institution.previewImages.length >= 2}
        <div class="d-flex flex-column h-100 border-start border-2 border-white" style="flex: 1 0 0;">
          {#each [institution.previewImages[1], institution.previewImages[2]] as image, i}
            <div
              class="flex-grow-1 h-50"
              class:border-bottom={i === 0}
              class:border-2={i === 0}
              class:border-white={i === 0}
            >
              {#if image}
                <BaseImage
                  class="w-100 h-100"
                  objectFit="cover"
                  asset={image}
                  preferredFormat="sm"
                  compact={true}
                  alt={institution.name.content || t("common.institution", { fallback: "Institution" })}
                />
              {:else}
                <div class="w-100 h-100 bg-light d-flex align-items-center justify-content-center">
                  <img src={imgSm} alt="" class="w-100 h-100" style="object-fit: cover;" />
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <div class="flex-grow-1 h-100 bg-light">
        <img src={imgSm} alt="" class="w-100 h-100" style="object-fit: cover;" />
      </div>
    {/if}
  </div>

  <div class="px-2 pt-1 pb-2 d-flex flex-column justify-content-between flex-grow-1 gap-3">
   
      <p class="line-clamp fw-semibold fs-7 text-body mb-0">
        {institution.name.content}
      </p>
     
    <div class="d-flex align-items-center gap-1"
      class:invisible={!institution.country?.content && !institution.location?.content}>
      <IconMapPin size={16} class="text-body-secondary flex-shrink-0" />
      <p class="text-truncate fs-7 text-body-secondary mb-0">
        {institution.country.content && institution.location.content
          ? `${institution.location.content}, ${institution.country.content}`
          : institution.country.content || institution.location.content || ""}
      </p>
    </div>
     

    <div class="d-flex gap-3">
      <div class="d-flex align-items-center gap-1 flex-shrink-0">
        <IconBox size={16} class="text-body-secondary flex-shrink-0" />
        <span class="fs-7 text-body-secondary text-nowrap">
          {institution.objectsCount}
          {#if institution.objectsCount == 1}
            {t("common.object")}
          {:else}
            {t("common.objects")}
          {/if}
        </span>
      </div>
      <div class="d-flex align-items-center gap-1 flex-shrink-0">
        <IconPhoto size={16} class="text-body-secondary flex-shrink-0" />
        <span class="fs-7 text-body-secondary text-nowrap">
          {institution.assetsCount}
          {t("common.media")}
        </span>
      </div>
    </div>
  </div>

  <a
    href="/projects/{institution.project_id}/institutions/{institution.id}"
    class="stretched-link"
    aria-label={institution.id}
  ></a>
</div>

<style>
  .line-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
  }
</style>
