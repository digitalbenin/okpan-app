<script>
  import BaseLinkedStatus from "$lib/components/base/BaseLinkedStatus.svelte";
  import { getAssetImageUrl } from "$lib/utils/media.js";

  let { asset, selected = $bindable([]) } = $props();

  const linked = $derived(
    asset.objectsAssets && asset.objectsAssets.length > 0,
  );
  
  // Selection logic
  let isSelected = $derived(selected.includes(asset.id));
  
  function handleCheckboxChange(event) {
    event.stopPropagation();
    if (isSelected) {
      selected = selected.filter((id) => id !== asset.id);
    } else {
      selected = [...selected, asset.id];
    }
  }
</script>

<div 
  class="w-100 d-flex flex-column rounded bg-white border mb-3 position-relative"
  class:border-primary={isSelected}
  class:border-2={isSelected}
>
  <input
    type="checkbox"
    class="form-check-input position-absolute top-0 end-0 m-2 z-1"
    checked={isSelected}
    onchange={handleCheckboxChange}
    onclick={(e) => e.stopPropagation()}
    aria-label="Select asset"
  />
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
  <div class="mt-auto p-2">
    <BaseLinkedStatus {linked} />
  </div>
</div>
