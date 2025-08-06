<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { selectParseFile } from "$lib/stores/ImportUtils.js";
  import TablePreview from "./TablePreview.svelte";
  import RootSelection from "./RootSelection.svelte";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  async function handleFileSelect() {
    wizard.nextEnabled = false;
    wizard.file = null; // Reset file before selecting a new one
    const response = await selectParseFile();
    //check for errors, usefetcher?
    wizard.file = response;
    if (wizard.file.format === "csv" || wizard.file.format === "tsv") {
      wizard.data = wizard.file.data; // Store the parsed data in the wizard context
      wizard.nextEnabled = true; // Enable next step after file selection
    }
  }

  $inspect(wizard.file); // For debugging purposes, can be removed later
</script>

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h3>
        {t("import.upload-title", {
          fallback:
            "Upload the file that contains the list of objects you want to import to your project.",
        })}
      </h3>
      <p class="w-75">
        {t("import.upload-description", {
          fallback:
            "You can upload a CSV, JSON, or XML file. Make sure the file is formatted correctly for the import process.",
        })}
      </p>
    </div>
  </div>
  <div class="row">
    <div class="col-12">
      <button class="btn btn-primary" onclick={handleFileSelect}>
        {t("import.select-file", { fallback: "Select File" })}
      </button>

      {#if wizard.file}
        <div class="alert alert-success mt-2" role="alert">
          {t("import.you-selected", {
            fallback: "You selected",
          })} a <code>{wizard.file.format}</code> file named
          <code>{wizard.file.fileName}</code>
          {#if wizard.file.format === "csv" || wizard.file.format === "tsv"}
            {t("common.with", { fallback: "with" })}
            <span class="fw-bold">{wizard.file.data.length}</span>
            {t("common.rows", { fallback: "rows" })}
          {/if}
        </div>
        {#if wizard.file.format === "csv" || wizard.file.format === "tsv"}
          <p class="mt-2">
            {t("import.preview-table", {
              fallback: "Preview of the first 25 rows",
            })}
          </p>
          <TablePreview data={wizard.file.data.slice(0, 25)} />
        {:else if wizard.file.format === "json"}
          <RootSelection jsonData={wizard.file.data}></RootSelection>
        {/if}
      {/if}
    </div>
  </div>
</div>
