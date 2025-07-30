<script>
  import { addImageProtocolPrefix } from "$lib/utils/images.js";
  const { src, id } = $props();
</script>

<div>
  {#if src}
    <img
      class="preview object-fit-cover rounded border"
      src={addImageProtocolPrefix(src)}
      alt={`Object ${id}`}
    />
  {:else}
    <div
      class="preview d-flex align-items-center justify-content-center bg-light rounded"
    >
      <i class="bi bi-image text-muted"></i>
    </div>
  {/if}
</div>

<style>
  .preview {
    width: 45px;
    height: 45px;
  }
</style>
