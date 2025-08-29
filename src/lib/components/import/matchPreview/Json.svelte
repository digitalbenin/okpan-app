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

  $inspect(tree); // For debugging purposes, can be removed later
</script>

<SuggestTemplate {templateSuggestions}></SuggestTemplate>
{#if wizard.useMatchingTemplate || wizard.useMatchingSuggestions || wizard.mapping.length > 0}
  <div class="w-100">
    <CardTree
      node={tree}
      matchingSuggestions={matchingSuggestions.current}
      matchingSuggestionsLoading={matchingSuggestions.loading}
      {fields}
    ></CardTree>
  </div>
{/if}
