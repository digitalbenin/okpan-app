<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { selectParseFile } from "$lib/stores/ImportUtils.js";
  import TablePreview from "./TablePreview.svelte";
  import RootSelection from "./RootSelection.svelte";
  import MultiSheetsSelection from "./MultiSheetsSelection.svelte";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  const ontologyFields = $derived.by(
    () => page.data?.ontologyFields?.result || page.data?.ontologyFields || []
  );

  const showDetectedParserPrompt = $derived.by(
    () => Boolean(wizard.file?.detectedPreset && !wizard.file?.preset && wizard.file?.parserChoice !== "declined")
  );

  const showDeclinedParserNotice = $derived.by(
    () => Boolean(wizard.file?.detectedPreset && !wizard.file?.preset && wizard.file?.parserChoice === "declined")
  );

  function resetImportState() {
    wizard.nextEnabled = false;
    wizard.file = null;
    wizard.data = [];
    wizard.mapping = [];
    wizard.useMatchingSuggestions = false;
    wizard.useMatchingTemplate = false;
    wizard.reusedTemplate = null;
  }

  // Resolves a preset-defined ontology field name (e.g. "object type") to its DB id.
  // Only used for fields explicitly mapped by a preset (LIDO, Linked Art, etc.) —
  // not as a fallback for arbitrary field names. Transformer model handles everything else.
  function resolvePresetOntologyFieldId(mappedFieldName) {
    if (!mappedFieldName) return null;
    const normalized = String(mappedFieldName).trim().toLowerCase();
    const match = ontologyFields.find(
      (field) => String(field?.name?.content || field?.name || '').trim().toLowerCase() === normalized
    );
    return match?.id || null;
  }

  function normalizePrefilledMapping(prefilledMapping) {
    return (prefilledMapping || []).map((entry) => ({
      ...entry,
      mappedField: entry?.mappedField ?? resolvePresetOntologyFieldId(entry?.mappedFieldName)
    }));
  }

  function applyParsedResponse(response, options = {}) {
    if (!response) {
      return;
    }

    const { advanceToMatch = false } = options;
    const parserChoice = response?.preset
      ? "accepted"
      : response?.detectedPreset
        ? "pending"
        : null;

    wizard.file = {
      ...response,
      parserChoice,
    };

    wizard.mapping = [];
    wizard.data = [];

    if (response.preset) {
      wizard.mapping = normalizePrefilledMapping(response.prefilledMapping);
    }

    const isTabular = Boolean(response.tabularized)
      || response.format === "csv"
      || response.format === "tsv"
      || (response.format === "xlsx" && !response.multiPage);
    const hasPreviewableRows = Array.isArray(response.data)
      && response.data.some((row) => row && typeof row === "object" && !Array.isArray(row));

    if (isTabular && hasPreviewableRows) {
      wizard.data = response.data;
      wizard.nextEnabled = response.preset ? wizard.mapping.length > 0 : true;

      if (advanceToMatch) {
        wizard.currentStep = 3;
      }

      return;
    }

    const canFallbackToStructuredMatching = response.preset
      && (response.format === "json" || response.format === "xml")
      && response.sourceData;

    if (canFallbackToStructuredMatching) {
      wizard.file = {
        ...wizard.file,
        data: response.sourceData,
        tabularized: false,
      };
      wizard.mapping = [];
      wizard.nextEnabled = false;

      if (advanceToMatch) {
        wizard.currentStep = 3;
      }

      return;
    }

    wizard.nextEnabled = false;
  }

  async function handleFileSelect() {
    resetImportState();
    const response = await selectParseFile();
    if (!response) {
      return;
    }

    applyParsedResponse(response);
  }

  async function useDetectedParser() {
    if (!wizard.file?.filePath || !wizard.file?.detectedPreset?.id) {
      return;
    }

    const response = await selectParseFile({
      filePath: wizard.file.filePath,
      selectedPreset: wizard.file.detectedPreset.id,
    });

    if (!response) {
      return;
    }

    applyParsedResponse(response, { advanceToMatch: true });
  }

  function declineDetectedParser() {
    wizard.file = {
      ...wizard.file,
      parserChoice: "declined",
    };
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

        {#if showDetectedParserPrompt}
          <div class="alert alert-primary mt-3" role="alert">
            <div class="fw-semibold mb-2">
              {t("import.compatible-parser-found", {
                fallback: "A compatible parser was found: {{name}}",
                name: wizard.file.detectedPreset.label,
              })}
            </div>
            <p class="mb-3">
              {t("import.compatible-parser-description", {
                fallback:
                  "You can use the parser to jump directly to the parsed field preview and suggested matches, or continue with the standard import flow.",
              })}
            </p>
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-primary btn-sm" onclick={useDetectedParser}>
                {t("import.use-detected-parser", { fallback: "Use parser" })}
              </button>
              <button class="btn btn-outline-secondary btn-sm" onclick={declineDetectedParser}>
                {t("import.continue-standard-import", { fallback: "Continue standard import" })}
              </button>
            </div>
          </div>
        {/if}

        {#if showDeclinedParserNotice}
          <div class="alert alert-secondary mt-3" role="alert">
            <div class="d-flex gap-2 flex-wrap align-items-center justify-content-between">
              <span>
                {t("import.compatible-parser-found", {
                  fallback: "A compatible parser was found: {{name}}",
                  name: wizard.file.detectedPreset.label,
                })}
              </span>
              <button class="btn btn-outline-secondary btn-sm" onclick={useDetectedParser}>
                {t("import.use-detected-parser", { fallback: "Use parser" })}
              </button>
            </div>
          </div>
        {/if}

        {#if wizard.file.parserWarnings?.length}
          <div class="alert alert-warning mt-3" role="alert">
            {#each wizard.file.parserWarnings as warning}
              <div>{warning}</div>
            {/each}
          </div>
        {/if}

        {#if wizard.file.multiPage}
          <MultiSheetsSelection
            filePath={wizard.file.filePath}
            sheets={wizard.file.sheets}
          />
        {/if}
        {#if (wizard.file.format === "csv" || wizard.file.format === "tsv" || wizard.file.format === "xlsx" || wizard.file.tabularized) && wizard.data.length}
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
