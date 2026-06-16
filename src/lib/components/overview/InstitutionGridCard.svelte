<script>
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import imgSm from "$assets/img_sm.png";
  const { t } = getTranslationStore();
  const { institution } = $props();
</script>

<a
  href="/projects/{institution.project_id}/institutions/{institution.id}"
  class="card border text-decoration-none text-reset h-100 rounded-4 overflow-hidden"
>
  <div class="bg-light overflow-hidden institution-image-strip">
    {#if institution.previewImages && institution.previewImages.length > 0}
      <div class="d-flex h-100">
        <div class="flex-grow-1 h-100">
          <BaseImage
            class="w-100 h-100"
            objectFit="cover"
            asset={institution.previewImages[0]}
            preferredFormat="sm"
            compact={true}
            alt={institution.name.content || ""}
          />
        </div>
        {#if institution.previewImages.length > 1}
          <div class="d-flex flex-column border-start overflow-hidden" style="width: 40%; gap: 1px;">
            {#each institution.previewImages.slice(1, 3) as image, i}
              <div class="flex-grow-1 overflow-hidden">
                <BaseImage
                  class="w-100 h-100"
                  objectFit="cover"
                  asset={image}
                  preferredFormat="sm"
                  compact={true}
                  alt={institution.name.content || ""}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="h-100">
        <img src={imgSm} alt="" class="w-100 h-100" style="object-fit: cover;" />
      </div>
    {/if}
  </div>

  <div class="px-2 pt-1 pb-2 d-flex flex-column justify-content-between" style="height: 120px;">
    <div class="d-flex flex-column gap-1">
      <div class="fw-semibold text-truncate fs-7">{institution.name.content}</div>
      {#if institution.location?.content || institution.country?.content}
        <div class="small text-body-secondary d-flex align-items-center gap-1 text-truncate">
          <i class="bi bi-geo-alt flex-shrink-0"></i>
          <span class="text-truncate">{[institution.location?.content, institution.country?.content].filter(Boolean).join(", ")}</span>
        </div>
      {/if}
    </div>
    <div class="d-flex gap-3 small text-body-secondary p-2">
      <span>
        <i class="bi bi-box me-1"></i>
        {institution.objectsCount}
        {institution.objectsCount === 1
          ? t("common.object", { fallback: "object" })
          : t("common.objects", { fallback: "objects" })}
      </span>
      <span>
        <i class="bi bi-images me-1"></i>
        {institution.assetsCount}
        {institution.assetsCount === 1
          ? t("common.asset", { fallback: "media" })
          : t("common.assets", { fallback: "media" })}
      </span>
    </div>
  </div>
</a>

<style>
  .institution-image-strip {
    height: 196px;
  }
</style>
