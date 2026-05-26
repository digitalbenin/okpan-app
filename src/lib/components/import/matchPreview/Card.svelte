<script>
  import { page } from "$app/state";
  import { watch } from "runed";
  import MatchBadge from "./MatchBadge.svelte";
  import SetMatch from "./SetMatch.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  let {
    values,
    field,
    mappedField,
    matchingSuggestion,
    matchingSuggestionsLoading,
    included = $bindable(true),
    i,
    tot,
  } = $props();

  const wizard = getImportWizardContext();

  const { t } = getTranslationStore();

  const editEnabled = $derived(wizard.useMatchingTemplate ? false : true);

  const mappedFieldIds = $derived.by(() => {
    if (!mappedField) return [];
    const arr = Array.isArray(mappedField) ? mappedField : [mappedField];
    return arr.map((m) => m?.mappedField).filter(Boolean);
  });

  const mappedFieldMatches = $derived.by(() => {
    if (!mappedFieldIds.length) return [];
    return mappedFieldIds
      .map((id) => page.data.ontologyFields.find((f) => f.id === id))
      .filter(Boolean)
      .map((ontologyField) => ({
        name: ontologyField.name.content,
        id: ontologyField.id,
        description: ontologyField.description.content,
        suggestion: false,
      }));
  });

  let fieldMatched = $derived.by(() => {
    if (!matchingSuggestion && !mappedField) {
      return null;
    }

    if (mappedFieldMatches.length) {
      // In template reuse mode a single headerField can map to multiple ontology fields.
      // This component still edits a single mapping in non-template mode, so we take the first.
      return mappedFieldMatches[0];
    }

    if (matchingSuggestion) {
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

  const slicedValues = $derived(
    values.length > 10 ? values.slice(0, 10).sort() : values.sort()
  );

  watch(
    [() => field, () => fieldMatched, () => included],
    (
      [field, fieldMatched, included],
      [prevField, prevFieldMatched, prevIncluded]
    ) => {
      // When reusing an existing template, wizard.mapping may contain duplicate headerField entries (Option B).
      // This UI is read-only in that mode, so we must not mutate mapping.
      if (!editEnabled) {
        return;
      }
      if (
        field === prevField &&
        fieldMatched?.id === prevFieldMatched?.id &&
        included === prevIncluded
      ) {
        return;
      }
      const entry = {
        headerField: field,
        mappedField: fieldMatched?.id,
        primary: false,
      };

      if (included) {
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
    <div class="fs-5 fw-bold text-break">{field}</div>
    <div class="flex-shrink-0 ms-2">
      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          id="field-include-{i}"
          bind:checked={included}
          disabled={!editEnabled}
        />
        <label class="form-check-label text-capitalize" for="field-include-{i}">
          {t("import.import-field", { fallback: "Import Field" })}
        </label>
      </div>
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
          {#if !editEnabled && mappedFieldMatches.length > 1}
            {#each mappedFieldMatches as mf (mf.id)}
              <MatchBadge field={mf} disabled={true} />
            {/each}
          {:else}
            {#if !fieldMatched}
              <div
                class="d-flex align-items-center gap-2 bg-warning-subtle border border-warning-subtle text-warning-emphasis px-3 py-1 rounded"
              >
                <i class="bi bi-exclamation-triangle-fill"></i>
                <span
                  >{t("import.field-unmapped", {
                    fallback: "This field is unmapped",
                  })}</span
                >
              </div>
            {:else}
              <MatchBadge bind:field={fieldMatched} disabled={!editEnabled} />
            {/if}
          {/if}
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
