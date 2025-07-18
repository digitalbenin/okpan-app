<script>
  import { addImageProtocolPrefix } from "$lib/utils/images.js";
  const { object } = $props();

  const object_id_accessor = (object) => {
    return (
      object.objectsOntologyFields?.find(
        (f) => f.ontologyField.name.content === "object id"
      )?.value || "Id not set"
    );
  };
</script>

<div class="d-flex align-items-center gap-2">
  {#if object.objectsAssets && object.objectsAssets.length > 0}
    <img
      class="preview object-fit-cover rounded"
      src={addImageProtocolPrefix(object.objectsAssets[0].asset.formats.sm)}
      alt={`Object ${object.id}`}
    />
  {:else}
    <div
      class="preview d-flex align-items-center justify-content-center bg-light rounded"
    >
      <i class="bi bi-image text-muted"></i>
    </div>
  {/if}
  <a
    class="link-dark"
    href="/projects/{object.project_id}/institutions/{object.institution_id}/objects/{object.id}"
  >
    {object_id_accessor(object)}
  </a>
</div>

<style>
  .preview {
    width: 45px;
    height: 45px;
  }
</style>
