<script>
  import { addImageProtocolPrefix } from "$lib/utils/images.js";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  const { object } = $props();
  const institution = $derived(object.institution?.name.content);
  const id = $derived(
    object.objectsOntologyFields?.find(
      (f) => f.ontologyField.name.content === "object id"
    )?.value || "Id not set"
  );

  const image = $derived(object.objectsAssets[0]?.asset);
</script>

<div class="card-object position-relative d-flex border rounded p-1 gap-2">
  <div
    class="img-wrapper bg-light rounded overflow-hidden flex-grow-0 flex-shrink-0"
  >
    {#if image}
      <img
        class="object-fit-contain w-100 h-100"
        src={addImageProtocolPrefix(image.formats.sm)}
        alt={id || "Object Image"}
      />
    {:else}
      <div class="d-flex align-items-center justify-content-center h-100 w-100">
        <i class="bi bi-image fs-3 text-secondary"></i>
      </div>
    {/if}
  </div>
  <div class="info d-flex flex-column">
    <div class="text-truncate">{id}</div>
    <p class="fs-7 text-black-50 mb-0">
      {institution}
    </p>
    <div class="mt-auto">
      <BaseBadgeStatus status={object.status}></BaseBadgeStatus>
    </div>
    <a
      href="/projects/{object.project_id}/institutions/{object.institution_id}/objects/{object.id}"
      class="stretched-link"
      aria-label={id}
    ></a>
  </div>
</div>

<style>
  .card-object {
    flex: 0 0 auto;
    width: 260px;
    scroll-snap-align: start;
  }

  .img-wrapper {
    height: 120px;
    width: 120px;
  }

  .info {
    min-width: 0;
  }

  .info p {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
