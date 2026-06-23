<script>
  import ItemsPreview from "./ItemsPreview.svelte";
  import ImportStats from "./ImportStats.svelte";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import { importObjectsAndTemplate } from "$lib/api/ObjectsApi.js";
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
    } finally {
      wizard.saving = false;
    }
  };

  wizard.save = handleSave;

  const finalData = $derived(
    parseData(wizard.data, wizard.mapping, wizard.file?.tabularized ? "csv" : wizard.file.format)
  );

  const identifierField = $derived(
    wizard.mapping.find((m) => m.primary)?.headerField || ""
  );
  const mappedCount = $derived(
    wizard.mapping.filter((m) => m.mappedField).length
  );

  function closeAndHome() {
    open = false;
    goto("/projects/" + wizard.projectId);
  }

  function goToImportAssets() {
    open = false;
    const searchParams = new URLSearchParams();
    if (wizard.institutionId) {
      searchParams.set("institution_id", wizard.institutionId);
    }
    const query = searchParams.toString();
    goto(`/projects/${wizard.projectId}/import-assets/steps${query ? `?${query}` : ""}`);
  }
</script>

<div class="row g-3">
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
    <div class="bg-white rounded-3 p-4 d-flex flex-column gap-4">
      <div>
        <h3>
          {t("import.ready-to-import", {
            fallback: "Ready to import",
          })}
        </h3>
        <p class="mb-0 text-body-secondary">
          {t("import.ready-to-import-description", {
            fallback: "Check that everything looks right before importing. You can go back to make changes.",
          })}
        </p>
      </div>

      <ImportStats
        objectsCount={wizard.data.length}
        fieldsCount={wizard.mapping.length}
        {mappedCount}
        {identifierField}
      />

      <ItemsPreview data={finalData} mapping={wizard.mapping} />
    </div>
  </div>
</div>

<BaseAlertDialog bind:open>
  {#snippet title()}
    {t("import.objects-imported", { fallback: "Objects imported correctly" })}
  {/snippet}
  {#snippet description()}
    <p class="mb-2">
      <span class="fw-bold">{wizard.data.length}</span>
      {t("import.objects-imported-summary", {
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
