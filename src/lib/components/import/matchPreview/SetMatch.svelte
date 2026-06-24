<script>
  import { watch } from "runed";
  import { page } from "$app/state";
  import { IconPlus, IconPencil } from "@tabler/icons-svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
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
          : "btn btn-secondary btn-sm",
    };

    const merged = {
      ...base,
      ...(buttonPropsOverride || {}),
      disabled: disabled,
    };

    if (disabled) merged.disabled = true;
    return merged;
  });

  let searchTerm = $state("");
  let selectedValues = $state([]);

  // Initialize from existing match (can be single object or array)
  let _initialized = false;
  watch(
    () => fieldMatched,
    (match) => {
      if (!_initialized && match) {
        const arr = Array.isArray(match) ? match : [match];
        const existingIds = arr.map((m) => m.id).filter(Boolean);
        if (existingIds.length) {
          _initialized = true;
          selectedValues = existingIds;
        }
      }
    }
  );

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

  function isSelected(id) {
    return selectedValues.includes(id);
  }

  function toggleItem(id) {
    if (isSelected(id)) {
      selectedValues = selectedValues.filter((v) => v !== id);
    } else {
      selectedValues = [...selectedValues, id];
    }
  }

  function updateMatch() {
    const matches = page.data.ontologyFields
      .filter((f) => selectedValues.includes(f.id))
      .map((f) => ({
        name: f.name.content,
        id: f.id,
        description: f.description.content,
        suggestion: false,
      }));
    if (matches.length) {
      onSetMatchChange(matches);
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
  <div class="border rounded mt-2" style="max-height: 350px; overflow-y: auto;">
    {#each items as item}
      <div
        class="form-check py-2 px-0 m-0 border-bottom"
        class:bg-primary-subtle={isSelected(item.value)}
      >
        <input
          class="form-check-input mx-2 px-0"
          type="checkbox"
          id="match-{item.value}"
          checked={isSelected(item.value)}
          onclick={() => toggleItem(item.value)}
        />
        <label class="form-check-label text-capitalize" for="match-{item.value}">
          {item.label}
          {#if item.suggested}
            <span class="badge rounded p-2 ms-2 bg-primary fw-normal">
              {t("import.suggested", { fallback: "Suggested" })}
            </span>
          {/if}
        </label>
      </div>
    {/each}
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

