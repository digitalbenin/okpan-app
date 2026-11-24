<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Card from "./Card.svelte";
  import SuggestTemplate from "./SuggestTemplate.svelte";
  import { createMatchingPreview } from "./matchingPreview.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  const rows = $derived.by(() =>
    Array.isArray(data)
      ? data.filter((row) => row && typeof row === "object" && !Array.isArray(row))
      : []
  );
  const fields = $derived.by(() => {
    const seen = new Set();

    for (const row of rows) {
      for (const field of Object.keys(row || {})) {
        seen.add(field);
      }
    }

    return [...seen];
  });
  const preview = createMatchingPreview(wizard, () => fields);
</script>

{#if preview.ready}
  <div class="content-stretch flex gap-16px items-center relative shrink-0 w-full" data-node-id="205:35219">
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
    {t("import.no-previewable-rows", {
      fallback: "The parsed file does not contain previewable tabular rows for field matching."
    })}
  </div>
{:else if preview.ready}
  <div class="w-100">
    <div class="d-flex align-items-center justify-content-between mb-2">
      <div class="form-check mb-0">
        <input
          class="form-check-input"
          type="checkbox"
          id="global-field-include"
          checked={preview.allIncluded}
          indeterminate={preview.mixedInclusion}
          disabled={wizard.useMatchingTemplate}
          onclick={preview.toggleAll}
        />
        <label class="form-check-label text-capitalize" for="global-field-include">
          {t("import.include-all-fields", { fallback: "Include all fields" })}
        </label>
      </div>
    </div>
    {#each fields as field, i (field)}
      {@const values = [...new Set(rows.map((row) => row[field]))]}
      {@const matchingSuggestion = preview.matchingSuggestions.current.find((entry) => entry.csvField === field)}
      <Card {values} {field} {matchingSuggestion} i={i + 1} tot={fields.length} />
    {/each}
  </div>
{/if}
