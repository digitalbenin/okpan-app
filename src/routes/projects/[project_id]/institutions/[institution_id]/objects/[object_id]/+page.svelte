<script>
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { back } from "$lib/utils/navigation.js";

  const { data } = $props();
  const { t } = getTranslationStore();
  $inspect(data.object);
  const objectId = $derived.by(() => {
    return (
      data.object.objectsOntologyFields?.find((f) => f.primary)?.value ||
      "Identifier not set"
    );
  });
</script>

<div class="container-fluid pb-4">
  <div class="row mb-2">
    <div class="col-12">
      <div class="d-flex align-items-start gap-3 mt-3">
        <div>
          <button
            class="btn btn-lg btn-light rounded-circle aspect-ratio-1x1"
            aria-label="back"
            onclick={back}><i class="bi bi-arrow-left"></i></button
          >
        </div>
        <div>
          <div class="text-black-50">{data.institution.name.content}</div>
          <h1>
            {objectId}
            <span class="badgeWrapper fs-6">
              <BaseBadgeStatus status={data.object.status} />
            </span>
          </h1>
        </div>

        <div class="ms-auto">
          <i class="bi bi-three-dots-vertical"></i>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .badgeWrapper {
    font-family: var(--bs-body-font-family) !important;
    vertical-align: text-top;
  }
</style>
