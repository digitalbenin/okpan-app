<script>
  import { page } from "$app/state";
  import { watch } from "runed";
  import { IconSparklesFilled, IconX, IconExclamationCircle } from "@tabler/icons-svelte";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
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

  // Local state — set once on AI arrival, then only changed by user actions
  // fieldMatched can be a single object or an array of objects (multi-match)
  let fieldMatched = $state(null);
  let aiApplied = $state(false);

  // Normalize fieldMatched to always be an array for display
  const fieldMatchedArray = $derived(
    fieldMatched
      ? (Array.isArray(fieldMatched) ? fieldMatched : [fieldMatched])
      : []
  );
  const fieldMatchedIds = $derived(fieldMatchedArray.map((m) => m.id).filter(Boolean));

  // Initialize from AI suggestion once
  watch(
    () => matchingSuggestion?.suggestions?.[0],
    (aiMatch) => {
      if (!aiMatch || aiApplied) return;
      aiApplied = true;
      fieldMatched = {
        name: aiMatch.ontologyFieldName,
        id: aiMatch.ontologyFieldId,
        description: aiMatch.ontologyFieldDescription,
        suggestion: true,
      };
      if (editEnabled && included) {
        wizard.addMappingEntry({
          headerField: field,
          mappedField: aiMatch.ontologyFieldId,
          primary: false,
        });
      }
    }
  );

  // Initialize from preset/template mappedField prop if no AI match
  watch(
    () => (fieldMatched ? null : mappedField),
    (mf) => {
      if (!mf || aiApplied || fieldMatched) return;
      const arr = Array.isArray(mf) ? mf : [mf];
      const ids = arr.map((m) => m?.mappedField).filter(Boolean);
      if (!ids.length) return;
      // Store ALL matches, not just the first
      fieldMatched = ids
        .map((id) => {
          const ontologyField = page.data.ontologyFields.find((f) => f.id === id);
          if (!ontologyField) return null;
          return {
            name: ontologyField.name.content,
            id: ontologyField.id,
            description: ontologyField.description.content,
            suggestion: false,
          };
        })
        .filter(Boolean);
    }
  );

  // Template reuse multi-match display
  const mappedFieldMatches = $derived.by(() => {
    if (editEnabled) return [];
    if (!mappedField) return [];
    const arr = Array.isArray(mappedField) ? mappedField : [mappedField];
    return arr
      .map((m) => m?.mappedField)
      .filter(Boolean)
      .map((id) => page.data.ontologyFields.find((f) => f.id === id))
      .filter(Boolean)
      .map((f) => ({
        name: f.name.content,
        id: f.id,
        description: f.description.content,
      }));
  });

  const slicedValues = $derived(
    values.length > 10 ? values.slice(0, 10).sort() : values.sort()
  );

  function resetFieldMatched() {
    fieldMatched = null;
    wizard.mapping = wizard.mapping.filter((m) => m.headerField !== field);
    lastSyncKey = `|${included}|${editEnabled}`;
  }

  function onToggleIncluded() {
    // watching the combined signal below handles wizard sync
  }

  function onSetMatchChange(matches) {
    if (!matches) return;
    const arr = Array.isArray(matches) ? matches : [matches];
    // Pre-set lastSyncKey so the sync watch skips the upcoming reactive fire
    const newKey = arr.length ? arr.map((m) => m.id).sort().join(',') : '';
    lastSyncKey = `${newKey}|${included}|${editEnabled}`;
    // Store the full array of matches
    fieldMatched = arr.length ? arr : null;
    // Sync all selected matches to wizard.mapping
    if (editEnabled && included) {
      wizard.mapping = wizard.mapping.filter((m) => m.headerField !== field);
      arr.forEach((match) => {
        wizard.addMappingEntry({
          headerField: field,
          mappedField: match.id,
          primary: false,
        });
      });
    }
  }

  // Sync local state to wizard.mapping whenever included changes
  let lastSyncKey = $state('');
  watch(
    () => `${fieldMatchedIds.join(',')}|${included}|${editEnabled}`,
    (key) => {
      if (key === lastSyncKey) return;
      lastSyncKey = key;
      if (!editEnabled) return;
      if (!included) {
        wizard.mapping = wizard.mapping.filter((m) => m.headerField !== field);
        return;
      }
      // If entries already exist for this field, don't touch them (multi-match handled in SetMatch)
      const existingCount = wizard.mapping.filter((m) => m.headerField === field).length;
      if (existingCount > 0) return;
      // Re-add ALL matches when re-including
      fieldMatchedIds.forEach((id) => {
        wizard.addMappingEntry({
          headerField: field,
          mappedField: id,
          primary: false,
        });
      });
    }
  );
</script>

<div
  class="bg-secondary-subtle px-3 py-2 mb-2 rounded"
  class:border-start={included}
  class:border-success={included && fieldMatchedArray.length}
  class:border-warning={included && !fieldMatchedArray.length}
  class:border-3={included}
>
  <div class="text-muted fs-7">
    {i}
    {t("common.of", { fallback: "of" })}
    {tot}
  </div>
  <div class="d-flex justify-content-between align-items-baseline mb-2">
    <div class="fw-semibold text-break" style="font-size: 20px; color: #51524e;">{field}</div>
    <div class="flex-shrink-0 ms-2">
      <div class="form-check">
        <input
          class="form-check-input"
          type="checkbox"
          id="field-include-{i}"
          bind:checked={included}
          disabled={!editEnabled}
          onchange={onToggleIncluded}
        />
        <label class="form-check-label text-capitalize" for="field-include-{i}">
          {t("import.import-field", { fallback: "Import field" })}
        </label>
      </div>
    </div>
  </div>

  {#if included}
    <div class="d-flex gap-2 border-bottom border-secondary mb-2 pt-2 pb-1">
      <div class="text-muted" style="width: 130px;">
        {t("import.preview", { fallback: "Preview" })}
      </div>
      <div class="d-flex flex-wrap align-items-center gap-1">
        {#if slicedValues.length}
          {#each slicedValues as value, idx}
            <span class="text-body">{value}</span>
            {#if idx + 1 < slicedValues.length}
              <span class="text-body-tertiary">|</span>
            {/if}
          {/each}
          {#if values.length > 10}
            <span class="text-body-tertiary">|</span>
            <span class="text-body-tertiary">
              {t("import.other-n", { fallback: "other {{n}}…", n: values.length - 10 })}
            </span>
          {/if}
        {:else}
          <span class="fst-italic text-muted">
            {t("import.no-values", { fallback: "No values available" })}
          </span>
        {/if}
      </div>
    </div>

    <div class="d-flex gap-2 align-items-center">
      <div class="text-muted flex-shrink-0" style="width: 130px;">
        {t("import.match-to", { fallback: "Match to" })}
      </div>
      <div class="d-flex align-items-center gap-2">
        {#if matchingSuggestionsLoading}
          <button class="btn btn-light btn-sm" type="button" disabled>
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span class="visually-hidden" role="status">
              {t("import.loading-suggestions", { fallback: "Loading suggestions..." })}
            </span>
          </button>
        {:else if !editEnabled && mappedFieldMatches.length > 1}
          {#each mappedFieldMatches as mf (mf.id)}
            <div class="d-inline-flex align-items-center bg-white rounded-2 text-capitalize px-2 py-1 me-1">
              {mf.name}
            </div>
          {/each}
        {:else}
          {#if fieldMatchedArray.length}
            {#each fieldMatchedArray as fm (fm.id)}
              <BaseTooltip>
                {#snippet trigger(props)}
                  <div class="d-flex align-items-stretch rounded-1 overflow-hidden" style="border: 1px solid #eaebe7;" {...(({ type, ...rest }) => rest)(props)}>
                    {#if fm.suggestion}
                      <span class="d-flex align-items-center px-2" style="background: #008060;" title={t("import.ai-suggested", { fallback: "AI suggested" })}>
                        <IconSparklesFilled size={14} class="text-white" />
                      </span>
                    {/if}
                    <span class="d-flex align-items-center gap-1 px-2 py-1 bg-white text-body text-capitalize" style="font-size: 14px;">
                      {fm.name}
                      {#if editEnabled}
                        <button
                          class="btn btn-sm p-0 lh-1"
                          onclick={resetFieldMatched}
                          aria-label={t("import.reset-match", { fallback: "Reset match" })}
                        >
                          <IconX size={14} />
                        </button>
                      {/if}
                    </span>
                  </div>
                {/snippet}
                {fm.description}
              </BaseTooltip>
            {/each}
          {:else}
            <div class="d-flex align-items-center gap-2 bg-warning-subtle border border-warning-subtle text-warning-emphasis px-3 py-1 rounded">
              <IconExclamationCircle size={14} />
              <span style="font-size: 14px;">
                {t("import.field-unmapped", { fallback: "This field is unmapped" })}
              </span>
            </div>
          {/if}
          <SetMatch
            {field}
            suggestions={matchingSuggestion?.suggestions}
            disabled={!editEnabled}
            fieldMatched={fieldMatched}
            {onSetMatchChange}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>
