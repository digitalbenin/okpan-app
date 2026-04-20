<script>
  import { getAssetImageUrl } from "$lib/utils/media.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { data } = $props();
  const { t } = getTranslationStore();

  const rows = $derived.by(() => {
    return data.map((item) => ({
      id: item.asset?.id || item.asset_id,
      imageUrl: getAssetImageUrl($state.snapshot(item.asset), "sm"),
      fileName: item.asset?.filename || "",
      linkedObjects: Array.isArray(item.objects_primary_ids)
        ? item.objects_primary_ids
        : Array.isArray(item.object_ids)
          ? item.object_ids
          : [],
    }));
  });
</script>

<div class="table-responsive">
  <table class="table align-middle mb-0 confirmation-table">
    <thead>
      <tr>
        <th>{t("common.image", { fallback: "Image" })}</th>
        <th>{t("common.name", { fallback: "Name" })}</th>
        <th>{t("common.linked-objects", { fallback: "Linked objects" })}</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row}
        <tr>
          <td class="image-col">
            {#if row.imageUrl}
              <img class="asset-preview" src={row.imageUrl} alt={row.fileName} />
            {:else}
              <div
                class="asset-preview d-flex align-items-center justify-content-center bg-light"
              >
                <i class="bi bi-image text-muted"></i>
              </div>
            {/if}
          </td>
          <td class="name-col">{row.fileName}</td>
          <td>
            {#if row.linkedObjects.length > 0}
              <span class="me-2">{t("common.linked-to", { fallback: "Linked to" })} →</span>
              {#each row.linkedObjects as objectId}
                <span style="font-size:1.1rem" class="badge text-bg-light border fw-medium me-2">{objectId}</span>
              {/each}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .confirmation-table thead th {
    color: var(--bs-body-color);
    font-size: 1.125rem;
    font-weight: 700;
    border-bottom-width: 1px;
  }

  .confirmation-table tbody td {
    font-size: 1rem;
    vertical-align: middle;
    border-bottom-color: var(--bs-border-color);
  }

  .image-col {
    width: 110px;
  }

  .asset-preview {
    width: 76px;
    height: 76px;
    object-fit: cover;
    border-radius: 0.375rem;
  }

  .name-col {
    min-width: 280px;
  }
</style>
