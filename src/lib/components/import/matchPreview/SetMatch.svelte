<script>
  import { page } from "$app/state";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseRadioGroup from "$lib/components/base/BaseRadioGroup.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    field,
    suggestions = [],
    fieldMatched = $bindable(),
    disabled = false,
    open = $bindable(false),
    triggerVariant = "edit",
    buttonProps: buttonPropsOverride = undefined,
  } = $props();
  const { t } = getTranslationStore();

  const buttonProps = $derived.by(() => {
    const base = {
      class:
        triggerVariant === "add"
          ? "btn btn-light btn-sm"
          : "btn btn-outline-secondary btn-sm",
    };

    const merged = {
      ...base,
      ...(buttonPropsOverride || {}),
      disabled: disabled,
    };

    // Always enforce disabled from prop
    if (disabled) merged.disabled = true;
    return merged;
  });

  let value = $derived(fieldMatched ? fieldMatched.id : null);
  const items = $derived.by(() => {
    return page.data.ontologyFields.result
      .map((s) => ({
        value: s.id,
        label: s.name.content,
        suggested: suggestions.some((ss) => ss.ontologyFieldId === s.id),
      }))
      .sort((a, b) => {
        if (a.suggested && !b.suggested) return -1;
        if (!a.suggested && b.suggested) return 1;
        return 0;
      });
  });

  function updateMatch() {
    fieldMatched = page.data.ontologyFields.result
      .filter((f) => f.id === value)
      .map((f) => ({
        name: f.name.content,
        id: f.id,
        description: f.description.content,
        suggestion: suggestions.some((ss) => ss.ontologyFieldId === f.id),
      }))[0];
    open = false;
  }
</script>

<BaseAlertDialog
  bind:open
  buttonProps={buttonProps}
>
  {#snippet title()}
    {t("import.edit-match", { fallback: "Edit matched field" })}
  {/snippet}
  {#snippet trigger()}
    {#if triggerVariant === "add"}
      <i class="bi bi-plus"></i>
      <span class="visually-hidden">{t("common.add", { fallback: "Add" })}</span>
    {:else}
      <i class="bi bi-pencil"></i>
      {t("import.edit-match", {
        fallback: "Edit matched field",
      })}
    {/if}
  {/snippet}
  {#snippet description()}
    {t("import.change-matched-field", {
      fallback: "Change the matched field for",
    })} <span class="fw-bold">{field}</span>
  {/snippet}

  <div class="mt-2">
    <BaseRadioGroup bind:value {items} />
  </div>
  {#snippet footer()}
    <button class="btn btn-success" onclick={updateMatch}>
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseAlertDialog>

