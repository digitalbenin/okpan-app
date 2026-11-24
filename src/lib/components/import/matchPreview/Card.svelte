<script>
  import { page } from "$app/state";
  import { IconSparklesFilled, IconX, IconExclamationCircle } from "@tabler/icons-svelte";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import SetMatch from "./SetMatch.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";

  let {
    values,
    field,
    matchingSuggestion,
    i,
    tot,
  } = $props();

  const wizard = getImportWizardContext();
  const { t } = getTranslationStore();

  const editEnabled = $derived(!wizard.useMatchingTemplate);
  const included = $derived(wizard.isFieldIncluded(field));
  const fieldMatches = $derived.by(() => {
    return wizard.mapping
      .filter((entry) => entry.headerField === field && entry.mappedField)
      .map((entry) => page.data.ontologyFields.find((ontologyField) => ontologyField.id === entry.mappedField))
      .filter(Boolean)
      .map((entry) => ({
        id: entry.id,
        name: entry.name.content,
        description: entry.description?.content,
        suggestion: wizard.isAutoMatch(field, entry.id),
      }));
  });

  const slicedValues = $derived(values.slice(0, 10).sort());
</script>

<div
  class="bg-secondary-subtle px-3 py-2 mb-2 rounded border-start border-3"
  class:border-success={included && fieldMatches.length}
  class:border-warning={included && !fieldMatches.length}
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
          checked={included}
          disabled={!editEnabled}
          onchange={(event) => wizard.setFieldIncluded(field, event.currentTarget.checked)}
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
      <div class="d-flex flex-wrap align-items-center gap-1 overflow-x-auto" style="min-width: 0;">
        {#if slicedValues.length}
          {#each slicedValues as value, idx (idx)}
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
        {#if fieldMatches.length}
          {#each fieldMatches as fm (fm.id)}
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
                        onclick={() => wizard.setFieldMatches(field, [])}
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
          fieldMatched={fieldMatches}
          onSetMatchChange={(matches) => wizard.setFieldMatches(field, matches)}
        />
      </div>
    </div>
  {/if}
</div>
