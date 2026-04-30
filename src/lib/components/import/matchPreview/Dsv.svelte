<script>
  import { watch, resource } from "runed";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Card from "./Card.svelte";
  import SuggestTemplate from "./SuggestTemplate.svelte";
  import {
    suggestFieldMappings,
    suggestTemplateReuse,
  } from "$lib/stores/ImportUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  const fields = $derived(Object.keys(data[0]));
  const hasPresetMapping = $derived.by(
    () => Boolean(wizard.file?.preset?.id && wizard.mapping.length > 0)
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
      if (skipSuggestions || !useMatchingSuggestions) {
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
      if (skipSuggestions) {
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
{#if wizard.useMatchingTemplate || wizard.useMatchingSuggestions || wizard.mapping.length > 0}
  <div class="w-100">
    <div class="d-flex align-items-center justify-content-between mb-2 px-3 py-2 bg-white border rounded">
      <span class="text-muted">
        {t("import.fields-count", { fallback: "{{count}} fields", count: fields.length })}
      </span>
      <div class="form-check mb-0">
        <input
          class="form-check-input"
          type="checkbox"
          id="global-field-include"
          checked={allIncluded}
          indeterminate={mixedInclusion}
          onclick={toggleAll}
        />
        <label class="form-check-label text-capitalize" for="global-field-include">
          {t("import.include-all-fields", { fallback: "Include all fields" })}
        </label>
      </div>
    </div>
    {#each fields as field, i}
      {@const values = [...new Set(data.map((s) => s[field]))]}
      {@const matchingSuggestion = matchingSuggestions.current.find(
        (s) => s.csvField === field
      )}
      {@const mappedField = wizard.mapping?.filter(
        (m) => m.headerField === field
      )}
      {#if field in fieldInclusion}
        <Card
          {values}
          {field}
          {mappedField}
          {matchingSuggestion}
          matchingSuggestionsLoading={matchingSuggestions.loading}
          bind:included={fieldInclusion[field]}
          i={i + 1}
          tot={fields.length}
        />
      {/if}
    {/each}
  </div>
{/if}
