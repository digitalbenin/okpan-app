<script>
  import { watch } from "runed";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import Card from "./Card.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { data, fields, matchingSuggestions, matchingSuggestionsLoading } =
    $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
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
    {@const matchingSuggestion = matchingSuggestions.find(
      (s) => s.csvField === field
    )}
    <Card
      {values}
      {field}
      {matchingSuggestion}
      {matchingSuggestionsLoading}
      i={i + 1}
      tot={fields.length}
    />
  {/each}
</div>
