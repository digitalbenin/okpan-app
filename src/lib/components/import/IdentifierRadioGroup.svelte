<script>
  import { watch } from "runed";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
  const { ontologyFields } = $props();

  const id = $derived.by(() => {
    //ontologyFields
    return ontologyFields.result.find((f) => f.name.content === "object id")
      ?.id;
  }); //Find a better way to get this dynamically

  const headerOptions = $derived.by(() => {
    const groups = new Map();
    for (const entry of wizard.mapping || []) {
      const headerField = entry?.headerField;
      if (!headerField) continue;
      if (!groups.has(headerField)) {
        const firstMapped = (wizard.mapping || []).find(
          (e) => e?.headerField === headerField && e?.mappedField
        )?.mappedField;
        const ontologyField = ontologyFields.result.find((f) => f.id === firstMapped);
        groups.set(headerField, {
          headerField,
          mappedField: firstMapped || null,
          mappedLabel: ontologyField?.name?.content || null,
          primary: Boolean(entry?.primary),
        });
      } else {
        const existing = groups.get(headerField);
        existing.primary = existing.primary || Boolean(entry?.primary);
      }
    }
    return Array.from(groups.values());
  });

  const defaultSelectedHeaderField = $derived.by(() => {
    const primary = wizard.mapping.find((f) => f.primary)?.headerField;
    if (primary) return primary;
    const objectIdFieldId = id;
    if (!objectIdFieldId) return null;
    return wizard.mapping.find((f) => f.mappedField === objectIdFieldId)
      ?.headerField;
  });

  let selected = $state(null);

  watch(
    () => defaultSelectedHeaderField,
    (next) => {
      if (selected === null && next) {
        selected = next;
      }
    }
  );

  watch(
    () => selected,
    (headerField) => {
      if (headerField) {
        wizard.setPrimaryHeaderField(headerField);
        wizard.nextEnabled = true;
      } else {
        wizard.setPrimaryHeaderField(null);
        wizard.nextEnabled = false;
      }
    }
  );
</script>

<div class="w-100">
  {#each headerOptions as field, i}
    <div class="bg-secondary-subtle rounded mb-2 px-3 py-2">
      <input
        type="radio"
        name="identifier"
        class="form-check-input"
        value={field.headerField}
        bind:group={selected}
      />
      <span class="ms-1 fw-bold text-break">{field.headerField}</span>
      <i class="bi bi-arrow-right"></i>
      {#if field.mappedLabel}
        <span class="text-capitalize">{field.mappedLabel}</span>
      {:else}
        <span class="text-muted fst-italic"
          >{t("import.not-set", { fallback: "Not set" })}</span
        >
      {/if}
    </div>
  {/each}
</div>
