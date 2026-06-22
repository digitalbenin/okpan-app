<script>
  import { watch, resource } from "runed";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import CardTree from "./CardTree.svelte";
  import SuggestTemplate from "./SuggestTemplate.svelte";
  import { analyzeJsonStructure, extractLeafPaths } from "$lib/utils/import.js";
  import {
    suggestFieldMappings,
    suggestTemplateReuse,
  } from "$lib/api/ImportApi.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  let tree = $derived(analyzeJsonStructure(data));

  const fields = $derived(extractLeafPaths(tree).sort());
  const isPresetImport = $derived.by(() => Boolean(wizard.file?.preset?.id));
  const skipTemplateSuggestions = $derived.by(
    () => Boolean(wizard.file?.preset?.id && wizard.file?.preset?.id !== "json-ld")
  );

  // Per-field inclusion tracking (all included by default)
  let fieldInclusion = $state({});
  watch(() => fields, (currentFields) => {
    for (const field of currentFields) {
      if (!(field in fieldInclusion)) {
        fieldInclusion[field] = true;
      }
    }
  }, { immediate: true });

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
    () => [fields, wizard.useMatchingSuggestions, isPresetImport, wizard.projectId],
    async (
      [allFields, useMatchingSuggestions, presetImport, projectId]
    ) => {
      if (allFields.length === 0) return [];

      if (presetImport) {
        // For preset imports: only run AI suggestions on fields the preset left unmapped
        const mappedHeaders = new Set(
          wizard.mapping.filter((m) => m.mappedField).map((m) => m.headerField)
        );
        const toSuggest = allFields.filter((f) => !mappedHeaders.has(f));
        if (!toSuggest.length) return [];
        return await suggestFieldMappings(toSuggest, { projectId });
      }

      if (!useMatchingSuggestions) return [];
      return await suggestFieldMappings(allFields, { projectId });
    },
    { initialValue: [] }
  );

  const templateSuggestions = resource(
    () => [fields, skipTemplateSuggestions],
    async ([fields, skipSuggestions], prevFields, { data, refetching, onCleanup, signal }) => {
      if (skipSuggestions || fields.length === 0) return [];

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

  const mappedCount = $derived.by(() => wizard.mapping.filter((m) => m.mappedField).length);
  const mappedPercent = $derived.by(() => fields.length ? Math.round((mappedCount / fields.length) * 100) : 0);

</script>

<div class="content-stretch flex gap-16px items-center relative shrink-0 w-full">
  <span>
    {mappedCount} {t("import.out-of", { fallback: "out of" })} {fields.length} {t("import.fields-are-mapped", { fallback: "fields are mapped" })}
  </span>
  <div class="progress flex-grow-1" style="height: 6px;">
    <div
      class="progress-bar"
      role="progressbar"
      style="width: {mappedPercent}%;"
      aria-valuenow={mappedPercent}
      aria-valuemin="0"
      aria-valuemax="100"
    ></div>
  </div>
</div>

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
