<script>
  import { watch } from "runed";
  import { IconSearch, IconBulb } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import MatchPreview from "./MatchPreview/MatchPreview.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";
  import { getOntologyFieldsByInstitution } from "$lib/api/OntologyFieldsApi.js";

  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();

  // State for field selection and matching
  let selectedFieldIds = $state([]);
  let isMatching = $state(false);
  let matchingSuggestions = $state([]);
  let hasMatched = $state(false);

  // State for institution-specific ontology fields
  let ontologyFields = $state([]);
  let isLoadingFields = $state(false);

  // Fetch ontology fields when institution changes
  watch(
    () => wizard.institutionId,
    async (institutionId) => {
      if (!institutionId || !wizard.projectId) {
        ontologyFields = [];
        return;
      }

      isLoadingFields = true;
      try {
        const result = await getOntologyFieldsByInstitution(wizard.projectId, institutionId);
        ontologyFields = Array.isArray(result) ? result : (result?.result || []);
      } catch (error) {
        console.error("Error fetching ontology fields by institution:", error);
        ontologyFields = [];
      } finally {
        isLoadingFields = false;
      }
    }
  );

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
      const toMap = wizard.assets.map((a) => ({
        id: a.id,
        filename: a.filename,
        formats: a.formats ? JSON.parse(JSON.stringify(a.formats)) : null,
      }));

      const suggestions = await window.api.suggestObjectMatches(toMap, {
        projectId: wizard.projectId,
        institutionId: wizard.institutionId,
        searchFields: [...selectedFieldIds],
        maxSuggestions: 3,
        minConfidence: 0.3,
      });

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

<div class="row g-3">
  <!-- Left column: main content -->
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
    <div class="bg-white rounded-3 p-4 d-flex flex-column gap-4">
      <div>
        <h3 class="mb-1">
          {t("import-assets.match-title", { fallback: "Link assets to objects" })}
        </h3>
        <p class="mb-0">
          {t("import-assets.match-description", {
            fallback:
              "In this step you can link assets to the objects of your collection. The automatic linking tries to match the filename of the assets with the primary field of the objects you have imported.",
          })}
        </p>
      </div>

      <div>
        <p class="fw-semibold mb-1">
          {t("import-assets.search-in-fields", { fallback: "Search in fields" })}
        </p>
        <p class="mb-2">
          {t("import-assets.click-start-matching", {
            fallback: "Select fields (optional) and click 'Start matching' to find object matches for your assets.",
          })}
        </p>
        <div class="w-100 d-flex align-items-start gap-3 p-0">
        <div class="flex-grow-1">
          {#if isLoadingFields}
            <div class="form-control text-body-secondary" style="pointer-events: none;">
              {t("common.loading", { fallback: "Loading..." })}
            </div>
          {:else}
            <BaseSelect
              items={ontologyFieldItems}
              bind:value={selectedFieldIds}
              type="multiple"
              placeholder={t("import-assets.select-fields-placeholder", { fallback: "Select fields..." })}
              disabled={isMatching}
            />
          {/if}
          <small class="text-body-secondary d-block mt-1">
            {t("import-assets.search-fields-hint", {
              fallback: "Leave empty to search only in primary fields.",
            })}
          </small>
          </div>
          <button
          class="btn btn-secondary"
          onclick={startMatching}
          disabled={isMatching || !wizard.assets.length}
        >
          {#if isMatching}
            <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            {t("common.matching", { fallback: "Matching..." })}
          {:else}
            <IconSearch size={16} class="me-1" />
            {t("import-assets.start-matching", { fallback: "Start matching" })}
          {/if}
        </button>
        </div>
        
      </div>

    </div>

    <!-- Results: detached, same col size -->
    {#if isMatching}
      <div class="d-flex justify-content-center py-4 px-4 mt-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">{t("common.loading", { fallback: "Loading..." })}</span>
        </div>
      </div>
    {:else if hasMatched && matchingSuggestions.length}
      <div class="bg-white rounded-3 p-4 mt-4 d-flex flex-column gap-3">
        <div class="d-flex gap-3 align-items-center">
          <span class="text-body-secondary flex-shrink-0">
            {wizard.mapping.filter((m) => m.object_ids?.length).length} {t("import.out-of", { fallback: "out of" })} {matchingSuggestions.length} {t("import-assets.assets-linked", { fallback: "assets are linked" })}
          </span>
          <div class="progress flex-grow-1" style="height: 6px;">
            <div
              class="progress-bar"
              role="progressbar"
              style="width: {matchingSuggestions.length ? Math.round((wizard.mapping.filter((m) => m.object_ids?.length).length / matchingSuggestions.length) * 100) : 0}%;"
              aria-valuenow={matchingSuggestions.length ? Math.round((wizard.mapping.filter((m) => m.object_ids?.length).length / matchingSuggestions.length) * 100) : 0}
              aria-valuemin="0"
              aria-valuemax="100"
            ></div>
          </div>
        </div>
        {#each matchingSuggestions as asset}
          <MatchPreview asset={asset.asset} results={asset.results} />
        {/each}
      </div>
    {:else if hasMatched}
      <p class="text-body-secondary fst-italic">
        {t("import-assets.no-matches-found", { fallback: "No matches found." })}
      </p>
    {/if}
  </div>

  <!-- Right column: info sidebar -->
  <div class="col-12 col-lg-4 col-xl-3">
    <div class="bg-white border rounded-3 p-4">
      <div class="d-flex flex-column gap-3">
        <div class="flex-shrink-0">
          <IconBulb size={16} stroke={2} />
        </div>
        <div>
          <p class="fw-semibold mb-1 text-body">
            {t("import-assets.match-help-title", { fallback: "How should I fill this?" })}
          </p>
          <div class="text-body-secondary fs-7">
            <p class="mb-2">
              {t("import-assets.match-help-desc-p1", {
                fallback: "Okpan tries to match each asset to an object by comparing the filename with the object identifier and any additional search fields you select.",
              })}
            </p>
            <p class="mb-0">
              {t("import-assets.match-help-desc-p2", {
                fallback: "If a match isn't correct, click the edit button to change it manually. Assets that don't match any object can be linked later from the object page.",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
