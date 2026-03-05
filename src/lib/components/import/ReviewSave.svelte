<script>
  import ItemsPreview from "./ItemsPreview.svelte";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import { importObjectsAndTemplate } from "$lib/stores/ObjectsUtils.js";
  import { parseData } from "$lib/utils/import.js";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { goto } from "$app/navigation";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  let open = $state(false);

  const saveFetcher = createFetcher(importObjectsAndTemplate);

  const handleSave = async function () {
    wizard.saving = true;
    try {
      const saveParams = {
        data: $state.snapshot(finalData),
        mapping: $state.snapshot(wizard.mapping),
        datasourceId: $state.snapshot(wizard.datasourceId),
        sourceFileName: wizard.file?.fileName || null,
      };
      console.log("Save parameters:", saveParams);

      const response = await saveFetcher.fetch(saveParams);
      console.log("Datasource saved:", response);
      wizard.importCompleted = true;
      open = true;
    } catch (error) {
      console.error("Error saving datasource:", error);
      // Handle error appropriately, e.g., show a notification
    } finally {
      wizard.saving = false;
    }
  };

  wizard.save = handleSave;

  const finalData = $derived(
    parseData(
      wizard.data,
      wizard.mapping,
      wizard.file?.tabularized ? "csv" : wizard.file.format
    )
  );
  function closeAndHome() {
    open = false;
    goto("/projects/" + wizard.projectId);
  }

  function goToImportAssets() {
    open = false;
    goto(`/projects/${wizard.projectId}/import-assets`);
  }
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
      <div>
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
          >{wizard.mapping.find((m) => m.primary)?.headerField || ""}</span
        >
      </div>
      <!-- <button class="btn btn-success btn-lg mt-3" onclick={handleSave}>
        {t("common.save-data", {
          fallback: "Save Data",
        })}
      </button> -->
    </div>
  </div>
  <div class="row">
    <div class="col-12">
      <ItemsPreview data={finalData} mapping={wizard.mapping} />
    </div>
  </div>
</div>

<BaseAlertDialog bind:open>
  {#snippet title()}
    {t("import.objects-imported", { fallback: "Objects imported correctly" })}
  {/snippet}
  <!-- {#snippet trigger()}
    <i class="bi bi-pencil"></i>
    {t("import.edit-link", {
      fallback: "Edit linked asset",
    })}
  {/snippet} -->
  {#snippet description()}
    <p class="mb-2">
      <span class="fw-bold">{wizard.data.length}</span>
      {t("import.match-description", {
        fallback: "objects imported correctly",
      })}
    </p>
    <p class="mb-0">
      {t("import.ask-import-media", {
        fallback: "Do you want to import linked media for these objects?",
      })}
    </p>
  {/snippet}
  {#snippet footer()}
    <button class="btn btn-outline-secondary" onclick={closeAndHome}>
      {t("common.no-skip", { fallback: "No, return to project" })}
    </button>
    <button class="btn btn-success" onclick={goToImportAssets}>
      {t("import.yes-import-media", { fallback: "Yes, import media" })}
    </button>
  {/snippet}
</BaseAlertDialog>
