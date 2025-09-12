<script>
  import MatchBadge from "./MatchBadge.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";

  let { suggestion, selection = $bindable() } = $props();
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();
  $inspect(suggestion);
  //   let objectLinked = $derived.by(() => {
  //     if (suggestion.results.length) {
  //       const obj = suggestion.results[0].object;
  //       obj.suggested = true;
  //       return obj;
  //     }
  //     return null;
  //   });

  //   let primaryId = $derived.by(() => {
  //     if (!objectLinked) return null;
  //     return getObjectIdentifier(objectLinked);
  //   });
</script>

<div class="row mb-3">
  <div class="col-3">
    <div class="text-break">
      {suggestion.asset.filename}
    </div>
  </div>
  <div class="col-9">
    <div class="rounded bg-secondary-subtle p-2">
      <div class="d-flex">
        <MatchBadge id={suggestion.results[0].object.id} />
      </div>
    </div>
  </div>
</div>
