<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";

  let {
    object,
    mappedObject = $bindable(null),
    suggested = false,
    assetId,
  } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();

  let primaryId = $derived.by(() => {
    if (!object) return null;
    return getObjectIdentifier(object);
  });

  let selected = $derived.by(() => {
    return mappedObject && object && mappedObject.id === object.id;
  });

  function handleSelect() {
    if (mappedObject && mappedObject.id === object.id) {
      mappedObject = null;
      wizard.removeMappingEntry(object, assetId);
    } else {
      mappedObject = object;
      wizard.addMappingEntry(object, assetId);
    }
  }
</script>

<div class="rounded bg-secondary-subtle p-2 mb-2">
  <div class="d-flex justify-content-between align-items-center">
    <div class="d-flex align-items-center gap-2">
      <div class="fw-bold">{primaryId}</div>
      <button class="btn btn-sm btn-outline-secondary" aria-label="Expand"
        ><i class="bi bi-arrows-expand"></i></button
      >
      {#if suggested}
        <span class="badge text-bg-primary"
          >{t("import.suggested", { fallback: "Suggested" })}
          <i class="bi bi-stars"></i></span
        >
      {/if}
    </div>

    <button
      class="btn btn-sm"
      class:btn-success={selected}
      class:btn-outline-secondary={!selected}
      onclick={handleSelect}
      ><i class="bi bi-{selected ? 'check-circle' : 'plus-circle'}"></i>
      select{selected ? "ed" : ""}</button
    >
  </div>
  <!-- <div>meta</div>
  <div>other media</div> -->
</div>
