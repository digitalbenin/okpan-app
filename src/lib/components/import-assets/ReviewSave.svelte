<script>
  //   import ItemsPreview from "./ItemsPreview.svelte";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import { bulkLinkAssetsToObjects } from "$lib/stores/AssetsUtils.js";

  import { parseData } from "$lib/utils/import.js";

  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();

  const saveFetcher = createFetcher(bulkLinkAssetsToObjects);

  async function handleSave() {
    try {
      const saveParams = $state.snapshot(wizard.mapping);

      console.log("Save parameters:", saveParams);

      const response = await saveFetcher.fetch(saveParams);
      console.log("Assets linked:", response);
    } catch (error) {
      console.error("Error linking assets:", error);
      // Handle error appropriately, e.g., show a notification
    }
  }

  //   const finalData = $derived(
  //     parseData(wizard.data, wizard.mapping, wizard.file.format)
  //   );
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
  <div class="row mb-2">
    <div class="col-12">
      <!-- <div>
        {wizard.data.length}
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
        <span class="fw-bold"
          >{wizard.mapping.find((m) => m.primary).headerField}</span
        >
      </div> -->
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
  <div class="row">
    <div class="col-12">
      <!-- <ItemsPreview data={finalData} mapping={wizard.mapping} /> -->
      preview data
    </div>
  </div>
</div>
