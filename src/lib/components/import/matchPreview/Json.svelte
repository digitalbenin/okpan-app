<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import CardTree from "./CardTree.svelte";
  import SuggestTemplate from "./SuggestTemplate.svelte";
  import { analyzeJsonStructure, extractLeafPaths } from "$lib/utils/import.js";
  import { createMatchingPreview } from "./matchingPreview.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  let tree = $derived(analyzeJsonStructure(data));

  const fields = $derived(extractLeafPaths(tree).sort());
  const preview = createMatchingPreview(wizard, () => fields);
</script>

{#if preview.ready}
<div class="content-stretch flex gap-16px items-center relative shrink-0 w-full">
  <span>
    {preview.mappedCount} {t("import.out-of", { fallback: "out of" })} {fields.length} {t("import.fields-are-mapped", { fallback: "fields are mapped" })}
  </span>
  <div class="progress flex-grow-1" style="height: 6px;">
    <div
      class="progress-bar"
      role="progressbar"
      style="width: {preview.mappedPercent}%;"
      aria-valuenow={preview.mappedPercent}
      aria-valuemin="0"
      aria-valuemax="100"
    ></div>
  </div>
</div>
{/if}

{#if !preview.ready && (preview.templateSuggestions.loading || preview.matchingSuggestions.loading)}
  <div class="d-flex flex-column align-items-center justify-content-center py-5">
    <div class="spinner-border text-primary mb-3" role="status">
      <span class="visually-hidden">{t("common.loading", { fallback: "Loading..." })}</span>
    </div>
    <p class="text-muted">
      {#if preview.templateSuggestions.loading}
        {t("import.analyzing-fields", { fallback: "Analyzing your fields and looking for matching templates..." })}
      {:else}
        {t("import.suggesting-matches", { fallback: "Suggesting field matches using AI. This may take a moment..." })}
      {/if}
    </p>
  </div>
{/if}
<SuggestTemplate templateSuggestions={preview.templateSuggestions} />
{#if !fields.length}
  <div class="alert alert-warning mt-3" role="alert">
    {t("import.no-structured-fields", {
      fallback: "The parsed file does not contain structured fields that can be matched here."
    })}
  </div>
{:else if preview.ready}
  <div class="w-100">
    <div class="d-flex align-items-center justify-content-between mb-2">
      <div class="form-check mb-0">
        <input
          class="form-check-input"
          type="checkbox"
          id="global-field-include-json"
          checked={preview.allIncluded}
          indeterminate={preview.mixedInclusion}
          disabled={wizard.useMatchingTemplate}
          onclick={preview.toggleAll}
        />
        <label class="form-check-label text-capitalize" for="global-field-include-json">
          {t("import.include-all-fields", { fallback: "Include all fields" })}
        </label>
      </div>
    </div>
    <CardTree
      node={tree}
      matchingSuggestions={preview.matchingSuggestions.current}
      {fields}
    ></CardTree>
  </div>
{/if}
