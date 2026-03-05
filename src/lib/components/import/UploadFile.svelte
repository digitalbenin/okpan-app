<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { selectParseFile } from "$lib/stores/ImportUtils.js";
  import TablePreview from "./TablePreview.svelte";
  import RootSelection from "./RootSelection.svelte";
  import MultiSheetsSelection from "./MultiSheetsSelection.svelte";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
  let selectedPresetId = $state("");

  function resetImportState() {
    wizard.nextEnabled = false;
    wizard.file = null;
    wizard.data = [];
    wizard.mapping = [];
    wizard.prefilledMapping = [];
    wizard.detectedPreset = null;
    wizard.availablePresets = [];
    wizard.parserWarnings = [];
    wizard.useMatchingTemplate = false;
    wizard.reusedTemplate = null;
  }

  function applyParsedResponse(response) {
    if (!response) return;

    wizard.file = response;
    wizard.detectedPreset = response.preset || null;
    wizard.availablePresets = response.availablePresets || [];
    wizard.parserWarnings = response.parserWarnings || [];
    wizard.prefilledMapping = response.prefilledMapping || [];
    selectedPresetId = response.preset?.id || "";

    if (wizard.prefilledMapping.length > 0) {
      wizard.mapping = $state.snapshot(wizard.prefilledMapping);
      wizard.nextEnabled = true;
    }

    if (
      response.format === "csv" ||
      response.format === "tsv" ||
      (response.format === "xlsx" && !response.multiPage) ||
      (response.tabularized && Array.isArray(response.data))
    ) {
      wizard.data = response.data || [];
      wizard.nextEnabled = true;
      return;
    }

    if (response.format === "json" || response.format === "xml") {
      wizard.data = [];
    }
  }

  async function handleFileSelect() {
    resetImportState();
    const response = await selectParseFile();
    if (!response) {
      return;
    }
    applyParsedResponse(response);
  }

  async function applyPresetOverride() {
    if (!wizard.file?.filePath) return;

    wizard.nextEnabled = false;
    const response = await selectParseFile({
      filePath: wizard.file.filePath,
      selectedPreset: selectedPresetId || null,
    });

    if (!response) {
      wizard.nextEnabled = true;
      return;
    }

    applyParsedResponse({
      ...response,
      filePath: wizard.file.filePath,
      fileName: wizard.file.fileName,
    });
  }

  //$inspect(wizard); // For debugging purposes, can be removed later
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
          {#if (wizard.file.format === "csv" || wizard.file.format === "tsv" || wizard.file.format === "xlsx") && wizard.data.length}
            {t("common.with", { fallback: "with" })}
            <span class="fw-bold">{wizard.file.data.length}</span>
            {t("common.rows", {
              fallback: "rows",
            })}
            {#if wizard.file.selectedSheet}
              {t("common.in-the-sheets", { fallback: "in the selected sheet" })}
              <span class="fw-bold">{wizard.file.selectedSheet}</span>
            {/if}
          {/if}
        </div>

        {#if wizard.availablePresets?.length}
          <div class="border rounded p-3 mb-3">
            <div class="d-flex flex-column flex-md-row align-items-md-end gap-2">
              <div class="flex-grow-1">
                <label class="form-label mb-1" for="preset-select">
                  {t("import.preset-parser", { fallback: "Parser preset" })}
                </label>
                <select id="preset-select" class="form-select" bind:value={selectedPresetId}>
                  <option value="">{t("import.auto-detect", { fallback: "Auto-detect" })}</option>
                  {#each wizard.availablePresets as preset}
                    <option value={preset.id}>{preset.label}</option>
                  {/each}
                </select>
                <div class="form-text">
                  {#if wizard.detectedPreset}
                    {t("import.detected-preset", { fallback: "Detected preset:" })}
                    <span class="fw-bold">{wizard.detectedPreset.label}</span>
                  {:else}
                    {t("import.no-preset-detected", { fallback: "No preset detected for this file." })}
                  {/if}
                </div>
              </div>
              <button class="btn btn-outline-secondary" onclick={applyPresetOverride}>
                {t("import.apply-preset", { fallback: "Apply parser" })}
              </button>
            </div>
          </div>
        {/if}

        {#if wizard.parserWarnings?.length}
          <div class="alert alert-warning">
            <ul class="mb-0">
              {#each wizard.parserWarnings as warning}
                <li>{warning}</li>
              {/each}
            </ul>
          </div>
        {/if}

        {#if wizard.file.multiPage}
          <MultiSheetsSelection
            filePath={wizard.file.filePath}
            sheets={wizard.file.sheets}
          />
        {/if}
        {#if ((wizard.file.format === "csv" || wizard.file.format === "tsv" || wizard.file.format === "xlsx") || wizard.file.tabularized) && wizard.data.length}
          <p class="mt-2">
            {t("import.preview-table", {
              fallback: "Preview of the first rows",
            })}
          </p>
          <TablePreview data={wizard.data.slice(0, 25)} />
        {:else if (wizard.file.format === "json" || wizard.file.format === "xml") && !wizard.file.tabularized}
          <RootSelection jsonData={wizard.file.data}></RootSelection>
        {/if}
      {/if}
    </div>
  </div>
</div>
