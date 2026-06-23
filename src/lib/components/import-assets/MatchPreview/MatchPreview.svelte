<script>
  import { watch } from "runed";
  import { IconArrowRight } from "@tabler/icons-svelte";
  import MatchBadge from "./MatchBadge.svelte";
  import SetMatch from "./SetMatch.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getAssetImageUrl } from "$lib/utils/media.js";

  const { asset, results } = $props();
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  let mappedObjects = $state([]);
  let _initialized = false;

  watch(
    () => results,
    (r) => {
      if (!_initialized && r?.length && r[0]) {
        _initialized = true;
        mappedObjects = [r[0].object];
      }
    }
  );

  // Sync mappedObjects changes to wizard.mapping
  watch(
    () => mappedObjects,
    (objects) => {
      if (objects.length) return;
      // When unlinked, clear the wizard mapping entry for this asset
      const existingMapping = wizard.mapping.find(
        (m) => m.asset_id === asset.id
      );
      if (!existingMapping || !existingMapping.object_ids?.length) return;
      existingMapping.object_ids = [];
      existingMapping.objects_primary_ids = [];
      wizard.mapping = [...wizard.mapping];
    }
  );

  const isMapped = $derived(mappedObjects.length > 0);
</script>

<div
  class="bg-gray-200 rounded-3 p-3 d-flex gap-3 border-start border-3"
  class:border-success={isMapped}
  class:border-warning={!isMapped}
>
  <div class="flex-shrink-0 overflow-hidden rounded-2" style="width: 80px; aspect-ratio: 1/1;">
    <img
      src={getAssetImageUrl(asset, 'md')}
      alt={asset.filename}
      class="object-fit-cover w-100 h-100"
    />
  </div>
  <div class="flex-grow-1 d-flex flex-column justify-content-center gap-1 min-w-0">
    <div class="d-flex align-items-center gap-2 flex-wrap">
      <span class="text-break fw-semibold">{asset.filename}</span>
      <IconArrowRight size={16} class="text-body-secondary flex-shrink-0" />
      <MatchBadge bind:mappedObjects />
      <SetMatch {asset} bind:mappedObjects suggestions={results} />
    </div>
  </div>
</div>
