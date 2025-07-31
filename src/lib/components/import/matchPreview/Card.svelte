<script>
  import { watch } from "runed";
  import MatchBadge from "./MatchBadge.svelte";
  import BaseCheckbox from "$lib/components/base/BaseCheckbox.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import SetMatch from "./SetMatch.svelte";

  let {
    values,
    field,
    matchingSuggestion,
    matched = $bindable(),
    i,
    tot,
  } = $props();
  const { t } = getTranslationStore();

  let fieldMatched = $derived({
    name: matchingSuggestion?.suggestions?.[0]?.ontologyFieldName,
    id: matchingSuggestion?.suggestions?.[0]?.ontologyFieldId,
    description: matchingSuggestion?.suggestions?.[0]?.ontologyFieldDescription,
  });

  let checked = $state(true);

  watch(
    [() => field, () => fieldMatched, () => checked],
    (
      [field, fieldMatched, checked],
      [prevField, prevFieldMatched, prevChecked]
    ) => {
      // update mapping
      console.log("Field changed:", field, fieldMatched, checked);
    }
  );

  //   $inspect(field, fieldMatched, checked);
</script>

<div class="bg-secondary-subtle px-3 py-2 mb-2 rounded">
  <div class="text-muted fs-7">
    {i}
    {t("common.of", { fallback: "of" })}
    {tot}
  </div>
  <div class="d-flex justify-content-between align-items-baseline mb-2">
    <div class="fs-5 fw-bold">{field}</div>
    <div>
      <BaseCheckbox
        bind:checked
        value={field}
        labelText={t("import.import-field", { fallback: "Import Field" })}
      />
    </div>
  </div>
  <div
    class="d-flex gap-2 border-bottom border-top border-secondary mb-2 pt-2 pb-1"
  >
    <div class="col-1 text-muted">
      {t("import.preview", { fallback: "Preview" })}
    </div>
    <div class="col d-flex flex-wrap overflow-hidden">
      {#each values.sort().slice(0, 11) as value}
        <div class="badge text-bg-secondary me-1 mb-1 text-truncate">
          {value}
        </div>
      {/each}
    </div>
    <div class="col-auto"></div>
  </div>
  <div class="d-flex gap-2 align-items-center">
    <div class="col-1 text-muted">
      {t("import.match-to", { fallback: "Match to" })}
      <i class="bi bi-arrow-right"></i>
    </div>
    <div class="col">
      <MatchBadge field={fieldMatched} />
      <SetMatch
        {field}
        suggestions={matchingSuggestion.suggestions}
        bind:fieldMatched
      />
    </div>
  </div>
</div>
