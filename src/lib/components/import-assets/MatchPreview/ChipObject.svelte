<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";
  import { getConnectionFieldColor } from "$lib/stores/ObjectsUtils.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getAssetImageUrl } from "$lib/utils/media.js";
  import BaseImage from "$lib/components/base/BaseImage.svelte";

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

  let connectionsOpen = $state(false);
  let institutionOpen = $state(false);
  let expanded = $state(false);
</script>

<div class="rounded bg-secondary-subtle p-2 mb-2">
  <div class="d-flex justify-content-between align-items-center">
    <div class="d-flex align-items-center gap-2">
      <div class="fw-bold">
        {primaryId}
      </div>

      {#if suggested}
        <span class="badge text-bg-primary"
          >{t("import.suggested", { fallback: "Suggested" })}
          <i class="bi bi-stars"></i></span
        >
      {/if}
    </div>

    <div class="d-flex align-items-center gap-2">
      <button 
        class="btn btn-sm btn-outline-secondary" 
        onclick={() => expanded = !expanded}
        aria-label={expanded ? "Collapse" : "Expand"}
      >
         <i class="bi bi-arrows-expand"></i>
      </button>

      <button
        class="btn btn-sm"
        class:btn-success={selected}
        class:btn-outline-secondary={!selected}
        onclick={handleSelect}
      >
        <i class="bi bi-{selected ? 'check-circle' : 'plus-circle'}"></i>
        {selected ? t("common.selected", {fallback: "Selected"}) : t("common.add", {fallback: "Add"})}
      </button>
    </div>
  </div>

  {#if expanded}
  <div class="mt-2 text-start">
    <div class="accordion accordion-flush mb-2">
    <!-- Connections Accordion -->
    <div class="accordion-item bg-transparent">
      <h2 class="accordion-header bg-transparent">
        <button 
          class="accordion-button bg-transparent py-1 fw-bold" 
          type="button" 
          class:collapsed={!connectionsOpen} 
          onclick={() => connectionsOpen = !connectionsOpen}
        >
          {t("common.connections", { fallback: "Connections" })}
        </button>
      </h2>
      <div class="accordion-collapse collapse" class:show={connectionsOpen}>
        <div class="accordion-body p-2">
          {#if object.objectsResearchFields && object.objectsResearchFields.length > 0}
            <div class="d-flex flex-wrap gap-2">
              {#each object.objectsResearchFields as field}
                <div 
                  class="d-flex align-items-center gap-2 p-2 rounded justify-content-start text-start" 
                  style="background-color: {getConnectionFieldColor(field.researchField?.name?.content)}; max-width: 300px;"
                >
                    <div style="width: 40px; height: 40px;" class="flex-shrink-0">
                         <BaseImage 
                            src={field.vocabulary?.mainAsset?.path ? `media://${field.vocabulary.mainAsset.path}` : null}
                            alt={field.vocabulary?.option?.content}
                            width={40}
                            height={40}
                            class="rounded-circle object-fit-cover" 
                            ratio="1/1"
                         />
                    </div>
                    
                    <div class="d-flex flex-column lh-sm overflow-hidden flex-grow-1" style="min-width: 0;">
                         <span class="fw-semibold small text-truncate d-block">
                             {field.value || field.vocabulary?.option?.content || "Unknown"}
                         </span>
                         <span class="text-muted text-truncate d-block" style="font-size: 0.75rem;">
                             {field.researchField?.name?.content || "Field"}
                         </span>
                    </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-muted small fst-italic">{t("common.no-connections", { fallback: "No connections found." })}</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- Institutional Data Accordion -->
    <div class="accordion-item bg-transparent mt-2">
      <h2 class="accordion-header bg-transparent">
        <button 
          class="accordion-button bg-transparent py-1 fw-bold" 
          type="button" 
          class:collapsed={!institutionOpen} 
          onclick={() => institutionOpen = !institutionOpen}
        >
          {t("common.institution-data", { fallback: "Institutional Data" })}
        </button>
      </h2>
      <div class="accordion-collapse collapse" class:show={institutionOpen}>
        <div class="accordion-body p-2">
          {#if object.institution}
            <div class="small mb-2">
              <div class="mb-1"><strong>{t("common.institution", { fallback: "Institution" })}:</strong> {object.institution.name?.content}</div>
            </div>
          {/if}
          
          {#if object.objectsOntologyFields && object.objectsOntologyFields.length > 0}
            <ul class="list-unstyled mb-0 small">
              {#each object.objectsOntologyFields as field}
                <li class="mb-1">
                  <strong>{field.ontologyField?.name?.content || "Field"}:</strong> 
                  <span class="text-break">{field.value}</span>
                </li>
              {/each}
            </ul>
          {:else if !object.institution}
             <div class="text-muted small fst-italic">{t("common.no-institution-data", { fallback: "No institutional data available." })}</div>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Object Assets Section -->
  {#if object.objectsAssets && object.objectsAssets.length > 0}
    <p class="mx-2 fw-bold mt-2 mb-1">{t("common.assets", { fallback: "Media" })}</p>
    <div class="mx-2 d-flex flex-row overflow-auto gap-2 p-1">
      {#each object.objectsAssets as link}
        <div style="width: 100px; height: 100px; flex: 0 0 100px;" class="border rounded overflow-hidden position-relative">
          {#if link.asset}
            <img 
              src={getAssetImageUrl(link.asset, 'sm')} 
              class="w-100 h-100 object-fit-cover" 
              alt={link.asset.filename || "Asset"} 
              title={link.asset.filename}
            />
          {:else}
             <div class="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                <i class="bi bi-file-earmark-image"></i>
             </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
  </div>
  {/if}
</div>
