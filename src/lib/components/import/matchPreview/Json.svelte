<script>
  import { watch, resource } from "runed";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import CardTree from "./CardTree.svelte";
  import SuggestTemplate from "./SuggestTemplate.svelte";
  import { analyzeJsonStructure, extractLeafPaths } from "$lib/utils/import.js";
  import {
    suggestFieldMappings,
    suggestTemplateReuse,
  } from "$lib/stores/ImportUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  let tree = $derived(analyzeJsonStructure(data));

  const fields = $derived(extractLeafPaths(tree).sort());
  const hasPresetMapping = $derived.by(
    () => Boolean(wizard.file?.preset?.id && wizard.mapping.some((m) => m.mappedField))
  );

  // Per-field inclusion tracking (all included by default)
  let fieldInclusion = $state({});
  $effect(() => {
    for (const field of fields) {
      if (!(field in fieldInclusion)) {
        fieldInclusion[field] = true;
      }
    }
  });

  const allIncluded = $derived(fields.length > 0 && fields.every((f) => fieldInclusion[f] !== false));
  const noneIncluded = $derived(fields.length > 0 && fields.every((f) => fieldInclusion[f] === false));
  const mixedInclusion = $derived(!allIncluded && !noneIncluded);

  function toggleAll() {
    const newVal = !allIncluded || mixedInclusion;
    for (const field of fields) {
      fieldInclusion[field] = newVal;
    }
  }

  const matchingSuggestions = resource(
    () => [fields, wizard.useMatchingSuggestions, hasPresetMapping],
    async (
      [fields, useMatchingSuggestions, skipSuggestions],
      { data, refetching, onCleanup, signal }
    ) => {
      if (skipSuggestions || !useMatchingSuggestions || fields.length === 0) {
        return [];
      }
      const response = await suggestFieldMappings(fields);
      return response;
    },
    { initialValue: [] }
  );

  const templateSuggestions = resource(
    () => [fields, hasPresetMapping],
    async ([fields, skipSuggestions], prevFields, { data, refetching, onCleanup, signal }) => {
      if (skipSuggestions || fields.length === 0) {
        return [];
      }

      const response = await suggestTemplateReuse(fields, wizard.projectId);
      if (response.totalMatches === 0) {
        wizard.useMatchingSuggestions = true;
      }
      return response.matchingTemplates;
    },
    { initialValue: [] }
  );

  watch(
    () => wizard.mapping,
    (mapping) => {
      wizard.nextEnabled = mapping.length > 0;
    }
  );


</script>

{#if templateSuggestions.loading || matchingSuggestions.loading}
  <div class="d-flex flex-column align-items-center justify-content-center py-5">
    <div class="spinner-border text-primary mb-3" role="status">
      <span class="visually-hidden">{t("common.loading", { fallback: "Loading..." })}</span>
    </div>
    <p class="text-muted">
      {#if templateSuggestions.loading}
        {t("import.analyzing-fields", { fallback: "Analyzing your fields and looking for matching templates..." })}
      {:else}
        {t("import.suggesting-matches", { fallback: "Suggesting field matches using AI. This may take a moment..." })}
      {/if}
    </p>
  </div>
{/if}
<SuggestTemplate {templateSuggestions}></SuggestTemplate>
{#if !fields.length}
  <div class="alert alert-warning mt-3" role="alert">
    {t("import.no-structured-fields", {
      fallback: "The parsed file does not contain structured fields that can be matched here."
    })}
  </div>
{:else}
  <div class="w-100">
    <div class="d-flex align-items-center justify-content-between mb-2 px-3 py-2 bg-white border rounded">
      <span class="text-muted">
        {t("import.fields-count", { fallback: "{{count}} fields", count: fields.length })}
      </span>
      <div class="form-check mb-0">
        <input
          class="form-check-input"
          type="checkbox"
          id="global-field-include-json"
          checked={allIncluded}
          indeterminate={mixedInclusion}
          onclick={toggleAll}
        />
        <label class="form-check-label text-capitalize" for="global-field-include-json">
          {t("import.include-all-fields", { fallback: "Include all fields" })}
        </label>
      </div>
    </div>
    <CardTree
      node={tree}
      matchingSuggestions={matchingSuggestions.current}
      matchingSuggestionsLoading={matchingSuggestions.loading}
      {fields}
      {fieldInclusion}
    ></CardTree>
  </div>
{/if}
