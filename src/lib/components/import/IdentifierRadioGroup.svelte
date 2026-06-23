<script>
  import { watch } from "runed";
  import { IconArrowRight } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
  const { ontologyFields } = $props();

  const fields = $derived(ontologyFields || []);

  const id = $derived.by(() => {
    return fields.find((f) => f.name.content === "object id")?.id;
  });

  const headerOptions = $derived.by(() => {
    const groups = new Map();
    for (const entry of wizard.mapping || []) {
      const headerField = entry?.headerField;
      if (!headerField) continue;
      if (!groups.has(headerField)) {
        const firstMapped = (wizard.mapping || []).find(
          (e) => e?.headerField === headerField && e?.mappedField
        )?.mappedField;
        const ontologyField = fields.find((f) => f.id === firstMapped);
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

<div class="w-100 border rounded-3">
  {#each headerOptions as field, i}
    <div class="bg-white border-bottom px-3 py-3"
      class:bg-primary-subtle={field.primary}>
      <input
        type="radio"
        name="identifier"
        class="form-check-input"
        value={field.headerField}
        bind:group={selected}
      />
      <span class="ms-1 fw-bold text-break">{field.headerField}</span>
      <IconArrowRight size={14} class="mx-1" />
      {#if field.mappedLabel}
        <span class="bg-secondary-subtle px-2 py-1 rounded"
          class:bg-secondary-subtle={!field.primary}
          class:bg-green-300={field.primary}
          >{field.mappedLabel}</span>
      {:else}
        <span class="text-muted fst-italic"
          >{t("import.not-set", { fallback: "Not set" })}</span
        >
      {/if}
    </div>
  {/each}
</div>
