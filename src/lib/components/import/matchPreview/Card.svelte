<script>
  import { watch } from "runed";
  import MatchBadge from "./MatchBadge.svelte";
  import SetMatch from "./SetMatch.svelte";
  import BaseCheckbox from "$lib/components/base/BaseCheckbox.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  let {
    values,
    field,
    matchingSuggestion,
    matchingSuggestionsLoading,
    matched = $bindable(),
    i,
    tot,
  } = $props();

  const wizard = getImportWizardContext();

  const { t } = getTranslationStore();

  let fieldMatched = $derived.by(() => {
    if (!matchingSuggestion?.suggestions?.length) {
      return null;
    }
    return {
      name: matchingSuggestion.suggestions[0].ontologyFieldName,
      id: matchingSuggestion.suggestions[0].ontologyFieldId,
      description: matchingSuggestion.suggestions[0].ontologyFieldDescription,
    };
  });

  let checked = $state(true);

  watch(
    [() => field, () => fieldMatched, () => checked],
    (
      [field, fieldMatched, checked],
      [prevField, prevFieldMatched, prevChecked]
    ) => {
      const entry = {
        headerField: field,
        mappedField: fieldMatched?.id,
        primary: false,
      };
      if (checked) {
        wizard.addMappingEntry(entry);
      } else {
        wizard.removeMappingEntry(entry);
      }
    }
  );

  function resetFieldMatched() {
    fieldMatched = null;
  }

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
      {#if values.length}
        {#each values.sort().slice(0, 11) as value}
          <div class="badge text-bg-secondary me-1 mb-1 text-truncate">
            {value}
          </div>
        {/each}
      {:else}
        <div class="badge text-bg-secondary me-1 mb-1 text-truncate fst-italic">
          {t("import.no-values", { fallback: "No values available" })}
        </div>
      {/if}
    </div>
    <div class="col-auto"></div>
  </div>
  <div class="d-flex gap-2 align-items-center">
    <div class="col-1 text-muted">
      {t("import.match-to", { fallback: "Match to" })}
      <i class="bi bi-arrow-right"></i>
    </div>
    <div class="col">
      {#if matchingSuggestionsLoading}
        <button class="btn btn-light" type="button" disabled>
          <span class="spinner-border spinner-border-sm" aria-hidden="true"
          ></span>
          <span class="visually-hidden" role="status"
            >{t("import.loading-suggestions", {
              fallback: "Loading suggestions...",
            })}</span
          >
        </button>
      {:else}
        <MatchBadge field={fieldMatched} />
        {#if fieldMatched}
          <button
            class="btn btn-outline-danger"
            onclick={resetFieldMatched}
            aria-label={t("import.reset-match", {
              fallback: "Reset match",
            })}
          >
            <i class="bi bi-x-lg"></i>
          </button>
        {/if}

        <SetMatch
          {field}
          suggestions={matchingSuggestion.suggestions}
          bind:fieldMatched
        />
      {/if}
    </div>
  </div>
</div>
