<script>
  import BaseImage from "$lib/components/base/BaseImage.svelte";

  const { src = null, id, asset = null, preferredFormat = "sm" } = $props();
</script>

<div>
  {#if src}
    <BaseImage
      class="rounded border overflow-hidden"
      style="width: 45px; height: 45px;"
      objectFit="cover"
      src={src}
      asset={asset}
      preferredFormat={preferredFormat}
      alt={`Object ${id}`}
      compact={true}
    />
  {:else if asset}
    <BaseImage
      class="rounded border overflow-hidden"
      style="width: 45px; height: 45px;"
      objectFit="cover"
      {asset}
      preferredFormat={preferredFormat}
      alt={`Object ${id}`}
      compact={true}
    />
  {:else}
    <div
      class="d-flex align-items-center justify-content-center bg-light rounded border overflow-hidden"
      style="width: 45px; height: 45px;"
    >
      <i class="bi bi-image text-muted"></i>
    </div>
  {/if}
</div>
