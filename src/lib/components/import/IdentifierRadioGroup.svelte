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
        // Collect ALL mapped fields for this header
        const allMapped = (wizard.mapping || [])
          .filter((e) => e?.headerField === headerField && e?.mappedField)
          .map((e) => e.mappedField);
        const labels = allMapped
          .map((id) => fields.find((f) => f.id === id)?.name?.content)
          .filter(Boolean);
        groups.set(headerField, {
          headerField,
          mappedLabels: labels,
          primary: Boolean(entry?.primary),
        });
      } else {
        const existing = groups.get(headerField);
        existing.primary = existing.primary || Boolean(entry?.primary);
      }
    }
    return Array.from(groups.values()).sort((a, b) => {
      // Primary identifier first, then mapped fields, then unmapped
      if (a.primary !== b.primary) return a.primary ? -1 : 1;
      const aMatched = a.mappedLabels.length > 0;
      const bMatched = b.mappedLabels.length > 0;
      if (aMatched !== bMatched) return aMatched ? -1 : 1;
      return 0;
    });
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
      <IconArrowRight size={14} class="ms-1" />
      {#if field.mappedLabels.length}
        {#each field.mappedLabels as label, idx}
        
          <span class="px-2 py-1 ms-2 rounded"
            class:bg-secondary-subtle={!field.primary}
            class:bg-green-300={field.primary}
            >{label}</span>
        {/each}
      {:else}
        <span class="text-muted fst-italic"
          >{t("import.not-set", { fallback: "Not set" })}</span
        >
      {/if}
    </div>
  {/each}
</div>
