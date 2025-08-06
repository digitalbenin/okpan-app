<script>
  import { watch, resource } from "runed";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import CardTree from "./CardTree.svelte";
  import { analyzeJsonStructure, extractLeafPaths } from "$lib/utils/import.js";
  import { suggestFieldMappings } from "$lib/stores/ImportUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  let tree = $derived(analyzeJsonStructure(data));

  const fields = $derived(extractLeafPaths(tree).sort());

  const matchingSuggestions = resource(
    () => fields,
    async (fields, prevFields, { data, refetching, onCleanup, signal }) => {
      const response = await suggestFieldMappings(fields);
      return response;
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

<div class="w-100">
  <CardTree
    node={tree}
    matchingSuggestions={matchingSuggestions.current}
    matchingSuggestionsLoading={matchingSuggestions.loading}
    {fields}
  ></CardTree>
</div>
