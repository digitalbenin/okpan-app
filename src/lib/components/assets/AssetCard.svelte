<script>
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import BaseLinkedStatus from "$lib/components/base/BaseLinkedStatus.svelte";

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
  class="w-100 d-flex flex-column rounded bg-white border border-white mb-3 position-relative"
  class:border-primary={isSelected}
  class:border-white={!isSelected}
  class:border-2={isSelected}
>
  <input
    type="checkbox"
    class="form-check-input position-absolute top-0 end-0 m-2 z-1"
    style="border: 1px solid var(--bs-gray-800);"
    checked={isSelected}
    onchange={handleCheckboxChange}
    onclick={(e) => e.stopPropagation()}
    aria-label="Select asset"
  />
  <div class="rounded ratio ratio-1x1 mb-3" style="background-color: var(--bs-gray-400);">
    <div>
      <BaseImage
        class="w-100 h-100"
        asset={asset}
        preferredFormat="md"
        objectFit="contain"
        alt={asset.id || "Asset Image"}
      />
    </div>
  </div>
  <div class="fs-5 mb-2 text-break p-2">
    <a
      href="/projects/{asset.project_id}/institutions/{asset.institution_id}/assets/{asset.id}"
      class="link-dark text-truncate text-decoration-none">{asset.filename}</a
    >
  </div>
  <div class="mt-auto p-2">
    <BaseLinkedStatus {linked} />
  </div>
</div>
