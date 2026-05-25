<script>
  import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  const { object } = $props();
  const institution = $derived(object.institution?.name.content);
  const title = $derived.by(
    () =>
      (object?.name?.content && String(object.name.content).trim()) ||
      (typeof object?.name === "string" && String(object.name).trim()) ||
      getObjectIdentifier(object)
  );

  const image = $derived(object.objectsAssets[0]?.asset);
</script>

<div class="card-object position-relative bg-white border rounded-2 overflow-hidden d-flex flex-column">
  <div class="flex-grow-1 bg-light d-flex align-items-center justify-content-center overflow-hidden">
    {#if image}
      <BaseImage
        class="w-100 h-100"
        objectFit="cover"
        asset={image}
        preferredFormat="sm"
        alt={title || ""}
      />
    {:else}
      <i class="bi bi-image fs-3 text-secondary"></i>
    {/if}
  </div>
  <div class="px-2 pt-1 pb-2 d-flex flex-column gap-1">
    <div class="fw-semibold text-truncate">{title}</div>
    {#if institution}
      <div class="text-body-secondary text-truncate">{institution}</div>
    {/if}
    <BaseBadgeStatus status={object.status} />
  </div>
  <a
    href="/projects/{object.project_id}/institutions/{object.institution_id}/objects/{object.id}"
    class="stretched-link"
    aria-label={title}
  ></a>
</div>

<style>
  .card-object {
    height: 242px;
    scroll-snap-align: start;
  }
</style>
