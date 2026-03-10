<script>
  import BaseBadgeStaus from "$lib/components/base/BaseBadgeStatus.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { t } = getTranslationStore();
  const { institution } = $props();
</script>

<div
  class="w-100 h-100 position-relative d-flex flex-column border p-2 rounded bg-white"
>
  <div class="d-flex justify-content-between align-items-center mb-2">
    <div><BaseBadgeStaus status={institution.status}></BaseBadgeStaus></div>
    <div><i class="bi bi-three-dots-vertical"></i></div>
  </div>
  <h5 class="line-clamp mb-1">
    {institution.name.content}
  </h5>
  {#if institution.country}
    <p class="text-truncate fs-7 mb-2">
      {institution.country.content}
    </p>
  {/if}
  <div class="mt-auto">
    <div class="imgWrapper w-100 rounded d-flex border overflow-hidden mb-2">
      {#if institution.previewImages && institution.previewImages.length > 0}
        <div class="col">
          <BaseImage
            class="w-100 h-100"
            objectFit="cover"
            asset={institution.previewImages[0]}
            preferredFormat="sm"
            compact={true}
            alt={institution.name.content || "Institution Image"}
          />
        </div>
        {#if institution.previewImages.length > 2}
          <div class="col-4 d-flex flex-column border-start">
            {#each institution.previewImages.slice(1, 3) as image, i}
              <div class="col" class:border-bottom={i === 0}>
                <BaseImage
                  class="w-100 h-100"
                  objectFit="cover"
                  asset={image}
                  preferredFormat="sm"
                  compact={true}
                  alt={institution.name.content || "Institution Image"}
                />
              </div>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="col bg-light">
          <div
            class="d-flex align-items-center justify-content-center h-100 w-100"
          >
            <i class="bi bi-image fs-3 text-secondary"></i>
          </div>
        </div>
      {/if}
    </div>
    <div class="d-flex fs-7">
      <div class="col">
        {institution.objectsCount}
        {#if institution.objectsCount < 2}
          {t("common.object", { fallback: "object" })}
        {:else}
          {t("common.objects", { fallback: "objects" })}
        {/if}
      </div>
      <div class="col">
        {institution.assetsCount}
        {#if institution.assetsCount < 2}
          {t("common.asset", { fallback: "media" })}
        {:else}
          {t("common.assets", { fallback: "media" })}
        {/if}
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
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .imgWrapper {
    height: 160px;
  }
</style>
