<script>
  import { watch, resource } from "runed";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Card from "./Card.svelte";
  import { suggestFieldMappings } from "$lib/stores/ImportUtils.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { data } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  const fields = $derived(Object.keys(wizard.file.data[0]));
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
</script>

<div class="w-100">
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
</div>
