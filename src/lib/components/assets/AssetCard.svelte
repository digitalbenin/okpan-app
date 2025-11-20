<script>
  import BaseLinkedStatus from "$lib/components/base/BaseLinkedStatus.svelte";
  import { getAssetImageUrl } from "$lib/utils/media.js";

  const { asset } = $props();

  const linked = $derived(
    asset.objectsAssets && asset.objectsAssets.length > 0,
  );
</script>

<div class="w-100 d-flex flex-column rounded bg-white border mb-3">
  <div class="bg-light rounded ratio ratio-1x1 mb-3">
    <div>
      <img
        class="object-fit-contain w-100 h-100"
        src={getAssetImageUrl(asset, 'md')}
        loading="lazy"
        alt={asset.id || "Asset Image"}
      />
    </div>
  </div>
  <div class="fs-5 mb-2 text-break p-2">
    <a
      href="/projects/{asset.project_id}/institutions/{asset.institution_id}/assets/{asset.id}"
      class="link-dark">{asset.filename}</a
    >
  </div>
  <div class="mt-auto p-2 d-flex justify-content-between align-items-center">
    <BaseLinkedStatus {linked} />
    <div>
      <i class="bi bi-three-dots-vertical"></i>
    </div>
  </div>
</div>
