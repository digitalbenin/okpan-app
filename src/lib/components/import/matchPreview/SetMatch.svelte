<script>
  import { page } from "$app/state";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseRadioGroup from "$lib/components/base/BaseRadioGroup.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { field, suggestions, fieldMatched = $bindable() } = $props();
  const { t } = getTranslationStore();

  let open = $state(false);
  let value = $derived(fieldMatched.id || null);
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
      }))[0];
    open = false;
  }
</script>

<BaseAlertDialog bind:open buttonProps={{ class: "btn btn-outline-secondary" }}>
  {#snippet title()}
    {t("import.edit-match", { fallback: "Edit matched field" })}
  {/snippet}
  {#snippet trigger()}
    <i class="bi bi-pencil"></i>
    {t("import.edit-match", {
      fallback: "Edit matched field",
    })}
  {/snippet}
  {#snippet description()}
    {t("import.match-description", {
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
