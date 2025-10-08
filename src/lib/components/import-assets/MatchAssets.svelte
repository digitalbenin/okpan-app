<script>
  import { resource } from "runed";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import MatchPreview from "./MatchPreview/MatchPreview.svelte";
  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  const matchingSuggestions = resource(
    () => wizard.assets,
    async (assets, preAssets, { data, refetching, onCleanup, signal }) => {
      if (!assets.length) {
        return [];
      }
      const toMap = assets.map((a) => ({
        id: a.id,
        filename: a.filename,
        formats: $state.snapshot(a.formats),
      }));
      const suggestions = await window.api.suggestObjectMatches(toMap, {
        institutionId: wizard.institutionId,
        searchFields: [],
        maxSuggestions: 3,
        minConfidence: 0.3,
      });
      console.log("Received suggestions", suggestions);
      wizard.mapping = suggestions.map((s) => {
        return {
          assetId: s.asset.id,
          objects: s.results[0] ? [s.results[0].object.id] : [],
        };
      });
      wizard.nextEnabled = true;
      return suggestions;
    },
    { initialValue: [] }
  );
  $inspect(wizard);
</script>

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h2 class="mt-3">
        {t("common.link-assets", { fallback: "Link assets to objects" })}
      </h2>
      <p>
        {t("common.link-assets-desc", {
          fallback:
            "In this step you can link assets to the objects of your collection. The automatic linking try to match the filename of the assets with the primary field of the objects you have imported.",
        })}
      </p>
    </div>
  </div>
  {#if matchingSuggestions.loading}
    <div class="row">
      <div class="col-12">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    </div>
  {:else if matchingSuggestions.current.length}
    {#each matchingSuggestions.current as asset}
      <MatchPreview asset={asset.asset} results={asset.results} />
    {/each}
  {/if}
</div>
