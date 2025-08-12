<script>
  import { page } from "$app/state";
  import { watch } from "runed";
  import MatchBadge from "./MatchBadge.svelte";
  import SetMatch from "./SetMatch.svelte";
  import BaseCheckbox from "$lib/components/base/BaseCheckbox.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  let {
    values,
    field,
    mappedField,
    matchingSuggestion,
    matchingSuggestionsLoading,
    matched = $bindable(),
    i,
    tot,
  } = $props();

  const wizard = getImportWizardContext();

  const { t } = getTranslationStore();

  let fieldMatched = $derived.by(() => {
    if (!matchingSuggestion && !mappedField) {
      return null;
    } else if (mappedField && mappedField.mappedField) {
      const ontologyField = page.data.ontologyFields.result.find(
        (f) => f.id === mappedField.mappedField
      );
      return {
        name: ontologyField.name.content,
        id: ontologyField.id,
        description: ontologyField.description.content,
        suggestion: false,
      };
    } else if (matchingSuggestion) {
      if (!matchingSuggestion?.suggestions?.length) {
        return null;
      }
      return {
        name: matchingSuggestion.suggestions[0].ontologyFieldName,
        id: matchingSuggestion.suggestions[0].ontologyFieldId,
        description: matchingSuggestion.suggestions[0].ontologyFieldDescription,
        suggestion: true,
      };
    }
  });

  let checked = $state(
    wizard.mapping.length === 0
      ? true
      : wizard.mapping.find((m) => m.headerField === field)
        ? true
        : false
  );

  const editEnabled = $derived(wizard.useMatchingTemplate ? false : true);

  const slicedValues = $derived(
    values.length > 10 ? values.slice(0, 10).sort() : values.sort()
  );

  watch(
    [() => field, () => fieldMatched, () => checked],
    (
      [field, fieldMatched, checked],
      [prevField, prevFieldMatched, prevChecked]
    ) => {
      if (
        field === prevField &&
        fieldMatched === prevFieldMatched &&
        checked === prevChecked
      ) {
        return;
      }
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
    },
    { lazy: true }
  );
</script>

<div class="bg-secondary-subtle border px-3 py-2 mb-2 rounded">
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
        disabled={!editEnabled}
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
      {#if slicedValues.length}
        {#each slicedValues as value, i}
          <!-- <div class="badge text-bg-secondary me-1 mb-1 text-truncate">
            {value}
          </div> -->
          <div
            class="px-1 text-truncate border-secondary"
            class:border-end={i + 1 < slicedValues.length}
          >
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
        <div class="d-flex align-items-center gap-2">
          <MatchBadge bind:field={fieldMatched} disabled={!editEnabled} />
          <SetMatch
            {field}
            suggestions={matchingSuggestion?.suggestions}
            disabled={!editEnabled}
            bind:fieldMatched
          />
        </div>
      {/if}
    </div>
  </div>
</div>
