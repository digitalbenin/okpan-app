<script>
  import Card from "./Card.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { data, fields, matchingSuggestions } = $props();
  const { t } = getTranslationStore();
</script>

<div class="w-100">
  {#each fields as field, i}
    {@const values = [...new Set(data.map((s) => s[field]))]}
    {@const matchingSuggestion = matchingSuggestions.find(
      (s) => s.csvField === field
    )}
    <Card {values} {field} {matchingSuggestion} i={i + 1} tot={fields.length} />
  {/each}
</div>
