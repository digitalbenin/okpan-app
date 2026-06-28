<script>
  import { IconLink, IconUnlink } from "@tabler/icons-svelte";
  import { getAssetImageUrl } from "$lib/utils/media.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { data } = $props();
  const { t } = getTranslationStore();

  const rows = $derived.by(() => {
    return data.map((item) => ({
      id: item.asset?.id || item.asset_id,
      imageUrl: getAssetImageUrl(item.asset, "sm"),
      fileName: item.asset?.filename || "",
      linkedIds: Array.isArray(item.objects_primary_ids) && item.objects_primary_ids.length
        ? item.objects_primary_ids
        : [],
    }));
  });
</script>

<div class="border rounded-3 overflow-hidden" style="border-color: #e0e0dc;">
  <div class="d-flex border-bottom px-3 py-2 fw-semibold text-body-secondary" style="font-size: 14px; border-color: #d5d6d0;">
    <span style="width: 93px; flex-shrink: 0;">{t("import-assets.table-image", { fallback: "Image" })}</span>
    <span style="width: 351px; flex-shrink: 0;">{t("import-assets.table-asset-name", { fallback: "Asset name" })}</span>
    <span class="flex-fill">{t("import-assets.table-linked-object", { fallback: "Linked object" })}</span>
  </div>
  {#each rows as row}
    <div class="d-flex border-bottom px-3 py-2 align-items-center" style="border-color: #d5d6d0;">
      <div class="flex-shrink-0" style="width: 93px;">
        {#if row.imageUrl}
          <img class="rounded" style="width: 64px; height: 64px; object-fit: cover;" src={row.imageUrl} alt={row.fileName} />
        {:else}
          <div class="rounded bg-light d-flex align-items-center justify-content-center" style="width: 64px; height: 64px;">
            <span class="text-body-secondary" style="font-size: 20px;">?</span>
          </div>
        {/if}
      </div>
      <span class="flex-shrink-0 text-body" style="width: 351px; font-size: 16px;">{row.fileName}</span>
      <div class="flex-fill d-flex flex-wrap align-items-center gap-2" style="min-width: 0;">
        {#if row.linkedIds.length}
          <IconLink size={16} class="text-primary flex-shrink-0" />
          {#each row.linkedIds as id, idx}
            <span class="text-body">{id}</span>
            {#if idx + 1 < row.linkedIds.length}<span class="text-body-secondary">|</span>{/if}
          {/each}
        {:else}
          <IconUnlink size={16} class="text-warning flex-shrink-0" style="color: #54420d;" />
          <span style="color: #54420d; font-size: 14px;">{t("import-assets.not-linked-label", { fallback: "Not linked" })}</span>
        {/if}
      </div>
    </div>
  {/each}
</div>
