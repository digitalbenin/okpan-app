<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import MatchPreview from "./MatchPreview/MatchPreview.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getObjectIdentifier } from "$lib/utils/objects.js";

  let { ontologyFields = [] } = $props();

  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  // State for field selection and matching
  let selectedFieldIds = $state([]);
  let isMatching = $state(false);
  let matchingSuggestions = $state([]);
  let hasMatched = $state(false);

  // Prepare ontology fields for multi-select dropdown
  const ontologyFieldItems = $derived(
    ontologyFields.map((f) => ({
      value: f.id,
      label: f.name?.content || f.name || f.id,
    }))
  );

  // Run matching when user clicks the button
  async function startMatching() {
    if (!wizard.assets.length) return;

    isMatching = true;
    hasMatched = false;

    try {
      // Use JSON serialization to ensure plain objects (avoid Proxy issues with IPC)
      const toMap = wizard.assets.map((a) => ({
        id: a.id,
        filename: a.filename,
        formats: a.formats ? JSON.parse(JSON.stringify(a.formats)) : null,
      }));

      const suggestions = await window.api.suggestObjectMatches(toMap, {
        institutionId: wizard.institutionId,
        searchFields: [...selectedFieldIds], // Spread to plain array (avoid Proxy issues with IPC)
        maxSuggestions: 3,
        minConfidence: 0.3,
      });

      console.log("Received suggestions", suggestions);

      matchingSuggestions = suggestions;
      wizard.mapping = suggestions.map((s) => {
        return {
          asset_id: s.asset.id,
          asset: s.asset,
          object_ids: s.results[0] ? [s.results[0].object.id] : [],
          objects_primary_ids: s.results[0]
            ? [getObjectIdentifier(s.results[0].object)]
            : [],
        };
      });
      wizard.nextEnabled = true;
      hasMatched = true;
    } catch (error) {
      console.error("Error matching assets:", error);
    } finally {
      isMatching = false;
    }
  }
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

  <!-- Field selection and start matching -->
  <div class="row mb-4">
    <div class="fw-semibold mb-1">
        {t("import-assets.search-in-fields", { fallback: "Search in fields" })}
      </div>
      <p>
          {t("import-assets.click-start-matching", {
            fallback: "Select fields (optional) and click 'Start matching' to find object matches for your assets.",
          })}
        </p>
    <div class="col-md-6">
      
      <BaseSelect
        items={ontologyFieldItems}
        bind:value={selectedFieldIds}
        type="multiple"
        placeholder={t("import-assets.select-fields-placeholder", { fallback: "Select fields..." })}
        disabled={isMatching}
      />
      <small class="text-muted d-block mt-1">
        {t("import-assets.search-fields-hint", {
          fallback: "Leave empty to search only in primary fields.",
        })}
      </small>
    </div>
    <div class="col-md-6 d-flex align-items-start">
      <button
        class="btn btn-primary"
        onclick={startMatching}
        disabled={isMatching || !wizard.assets.length}
      >
        {#if isMatching}
          <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          {t("common.matching", { fallback: "Matching..." })}
        {:else}
          <i class="bi bi-search me-2"></i>
          {t("import-assets.start-matching", { fallback: "Start matching" })}
        {/if}
      </button>
    </div>
  </div>

  <!-- Results -->
  {#if isMatching}
    <div class="row">
      <div class="col-12">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">{t("common.loading", { fallback: "Loading..." })}</span>
        </div>
      </div>
    </div>
  {:else if hasMatched && matchingSuggestions.length}
    {#each matchingSuggestions as asset}
      <MatchPreview asset={asset.asset} results={asset.results} />
    {/each}
  {:else if hasMatched}
    <div class="row">
      <div class="col-12">
        <p class="text-muted fst-italic">
          {t("import-assets.no-matches-found", { fallback: "No matches found." })}
        </p>
      </div>
    </div>
  {:else}
    <div class="row">
      <div class="col-12">
        
      </div>
    </div>
  {/if}
</div>
