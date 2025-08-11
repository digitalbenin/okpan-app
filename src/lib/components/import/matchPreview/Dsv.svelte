<script>
  import { watch, resource } from "runed";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Card from "./Card.svelte";
  import TemplatePreview from "./TemplatePreview.svelte";
  import {
    suggestFieldMappings,
    suggestTemplateReuse,
  } from "$lib/stores/ImportUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  const fields = $derived(Object.keys(data[0]));
  const matchingSuggestions = resource(
    () => [fields, wizard.useMatchingSuggestions],
    async (
      [fields, useMatchingSuggestions],
      { data, refetching, onCleanup, signal }
    ) => {
      if (!useMatchingSuggestions) {
        return [];
      }
      const response = await suggestFieldMappings(fields);
      return response;
    },
    { initialValue: [] }
  );

  const templateSuggestions = resource(
    () => fields,
    async (fields, prevFields, { data, refetching, onCleanup, signal }) => {
      const response = await suggestTemplateReuse(fields, wizard.projectId);
      return response.matchingTemplates || [];
    },
    { initialValue: [] }
  );

  watch(
    () => wizard.mapping,
    (mapping) => {
      wizard.nextEnabled = mapping.length > 0;
    }
  );

  $inspect(wizard, templateSuggestions.current);
</script>

{#if !templateSuggestions.loading && templateSuggestions.current.length > 0}
  <div class="alert alert-info">
    {t("import.match-template-reuse", {
      fallback: "We found some mappings that might match your data structure.",
    })}

    {#each templateSuggestions.current as template}
      <TemplatePreview {template} />
    {/each}
  </div>
{/if}
<!-- <div class="w-100">
  {#each fields as field, i}
    {@const values = [...new Set(data.map((s) => s[field]))]}
    {@const matchingSuggestion = matchingSuggestions.current.find(
      (s) => s.csvField === field
    )}
    <Card
      {values}
      {field}
      {matchingSuggestion}
      matchingSuggestionsLoading={matchingSuggestions.loading}
      i={i + 1}
      tot={fields.length}
    />
  {/each}
</div> -->
