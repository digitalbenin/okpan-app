<script>
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import { importObjectsAndTemplate } from "$lib/stores/ObjectsUtils.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  const saveFetcher = createFetcher(importObjectsAndTemplate);

  async function handleSave() {
    try {
      const response = await saveFetcher.fetch({
        data: wizard.file.data,
        mapping: wizard.mapping,
        datasourceId: wizard.datasourceId,
      });
      console.log("Datasource saved:", response);
    } catch (error) {
      console.error("Error saving datasource:", error);
      // Handle error appropriately, e.g., show a notification
    }
  }
  $inspect(wizard);
</script>

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h3>
        {t("import.review-start", {
          fallback: "Review your data and save it to the archive.",
        })}
      </h3>
      <p class="w-75">
        {t("import.review-description", {
          fallback:
            "In this step, you’ll see a summary of your data and can make final adjustments before saving it to the archive. This is your chance to ensure everything is correct and ready for archiving.",
        })}
      </p>
    </div>
  </div>
  <div class="row">
    <div class="col-12">
      <div>
        {wizard.file.data.length}
        {t("import.objects-will-be-imported", {
          fallback: "objects will be imported",
        })}
      </div>
      <div>
        {wizard.mapping.length}
        {t("import.fields-will-be-imported", {
          fallback: "fields will be imported",
        })}
        {t("common.and", {
          fallback: "and",
        })}
        {wizard.mapping.filter((m) => m.mappedField).length}
        {t("import.fields-are-mapped", {
          fallback: "fields are mapped",
        })}.
      </div>
      <div>
        {t("import.primary-field-set-to", {
          fallback: "Object identifier field is set to",
        })}
        {wizard.mapping.find((m) => m.primary).headerField}
      </div>
      <button class="btn btn-success btn-lg mt-3" onclick={handleSave}>
        {t("common.save-data", {
          fallback: "Save Data",
        })}
      </button>
      {#if saveFetcher.isLoading}
        <div>loading</div>
      {/if}
    </div>
  </div>
</div>
