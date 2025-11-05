<script>
  import MatchBadge from "./MatchBadge.svelte";
  import SetMatch from "./SetMatch.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";
  import { getAssetImageUrl } from "$lib/utils/images.js";

  const { asset, results } = $props();
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();
  //   let objectLinked = $derived.by(() => {
  //     if (suggestion.results.length) {
  //       const obj = suggestion.results[0].object;
  //       obj.suggested = true;
  //       return obj;
  //     }
  //     return null;
  //   });

  // const suggestedObject = $derived.by(() => {
  //   if (results.length) {
  //     return results[0].object;
  //   }
  //   return null;
  // });

  let mappedObject = $state(results[0] ? results[0].object : null);
</script>

<div class="row mb-3 bg-secondary-subtle rounded mx-1">
  <div class="col-3">
    <div class="p-2">
      <!-- <div class="text-break fw-bold lh-0 mb-2">{asset.filename}</div> -->
      <div class="square-image-container">
        <img
          src={getAssetImageUrl(asset, 'md')}
          alt={asset.filename}
          class="object-fit-contain w-100 h-100"
        />
      </div>
    </div>
  </div>
  <div class="col-9">
    <div class="p-2 border-start">
      <div class="d-flex align-items-center gap-2">
        <div class="text-break fw-bold">{asset.filename}</div>
        <div><i class="bi bi-arrow-right-short fs-4"></i></div>
        <MatchBadge bind:mappedObject />
        <SetMatch {asset} bind:mappedObject suggestions={results} />
      </div>
    </div>
  </div>
</div>

<style>
  .square-image-container {
    width: 100%;
    aspect-ratio: 1 / 1;
    position: relative;
    overflow: hidden;
  }
</style>
