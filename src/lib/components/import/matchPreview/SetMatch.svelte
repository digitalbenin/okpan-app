<script>
  import { page } from "$app/state";
  import { IconPlus, IconPencil } from "@tabler/icons-svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseRadioGroup from "$lib/components/base/BaseRadioGroup.svelte";
  import BaseSearchBar from "$lib/components/base/BaseSearchBar.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    field,
    suggestions = [],
    fieldMatched = null,
    onSetMatchChange = () => {},
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
  let searchTerm = $state("");

  const allItems = $derived.by(() => {
    return page.data.ontologyFields
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

  const items = $derived.by(() => {
    if (!searchTerm.trim()) return allItems;
    const query = searchTerm.toLowerCase().trim();
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(query)
    );
  });

  function updateMatch() {
    const match = page.data.ontologyFields
      .filter((f) => f.id === value)
      .map((f) => ({
        name: f.name.content,
        id: f.id,
        description: f.description.content,
        suggestion: false,
      }))[0];
    if (match) {
      onSetMatchChange(match);
    }
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
      <IconPlus size={14} />
      <span class="visually-hidden">{t("common.add", { fallback: "Add" })}</span>
    {:else}
      <IconPencil size={14} />
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

  <BaseSearchBar border="border-secondary-gray-200" bind:search={searchTerm} placeholder={t("import.search-fields", { fallback: "Search" })} width="100%" />
  <div class="mt-2">
    <BaseRadioGroup bind:value {items} />
  </div>
  {#snippet footer()}
    <button class="btn btn-outline-secondary" onclick={() => (open = false)}>
      {t("common.cancel", { fallback: "Cancel" })}
    </button>
    <button class="btn btn-success" onclick={updateMatch}>
      {t("objects.save-changes", { fallback: "Save changes" })}
    </button>
  {/snippet}
</BaseAlertDialog>

