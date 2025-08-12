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

  let selected = $state(
    wizard.mapping.find((f) => f.mappedField === id)?.mappedField || null
  );

  watch(
    () => selected,
    (id) => {
      if (id) {
        wizard.setMappingIdentifier(id);
        wizard.nextEnabled = true;
      } else {
        wizard.setMappingIdentifier(null);
        wizard.nextEnabled = false;
      }
    }
  );
</script>

<div class="w-100">
  {#each wizard.mapping as field, i}
    {@const ontologyField = ontologyFields.result.find(
      (f) => f.id === field.mappedField
    )}

    <div class="bg-secondary-subtle rounded mb-2 px-3 py-2">
      <input
        type="radio"
        name="identifier"
        class="form-check-input"
        value={field.mappedField}
        bind:group={selected}
      />
      <span class="ms-1 fw-bold">{field.headerField}</span>
      <i class="bi bi-arrow-right"></i>
      {#if ontologyField}
        <span class="text-capitalize">{ontologyField.name.content}</span>
      {:else}
        <span class="text-muted fst-italic"
          >{t("import.not-set", { fallback: "Not set" })}</span
        >
      {/if}
    </div>
  {/each}
</div>
