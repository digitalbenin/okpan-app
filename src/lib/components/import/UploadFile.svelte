<script>
  import { page } from "$app/state";
  import { IconBulb, IconCircleCheckFilled, IconInfoCircleFilled, IconRefresh } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { selectParseFile } from "$lib/api/ImportApi.js";
  import DataFileUploadZone from "./DataFileUploadZone.svelte";
  import TablePreview from "./TablePreview.svelte";
  import RootSelection from "./RootSelection.svelte";
  import MultiSheetsSelection from "./MultiSheetsSelection.svelte";
  import TemplateAdoptionModal from "./TemplateAdoptionModal.svelte";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  const ontologyFields = $derived.by(
    () => page.data?.ontologyFields?.result || page.data?.ontologyFields || []
  );

  const showDetectedParserPrompt = $derived.by(
    () => Boolean(wizard.file?.detectedPreset && !wizard.file?.preset && wizard.file?.parserChoice !== "declined")
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
      if (response.preset) {
        wizard.useMatchingSuggestions = true;
      }
      wizard.nextEnabled = response.preset ? wizard.mapping.length > 0 : true;

      if (advanceToMatch) {
        wizard.currentStep = wizard.currentStep + 1;
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
      wizard.useMatchingSuggestions = true;
      // Keep parser-provided mappings so only still-unmapped JSON fields go to AI suggestions.
      wizard.nextEnabled = wizard.mapping.length > 0;

      if (advanceToMatch) {
        wizard.currentStep = wizard.currentStep + 1;
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

    applyParsedResponse(response);
  }

  function declineDetectedParser() {
    wizard.file = {
      ...wizard.file,
      parserChoice: "declined",
    };
  }

  function handleReupload() {
    resetImportState();
    handleFileSelect();
  }

  //$inspect(wizard); // For debugging purposes, can be removed later
</script>

<div class="row g-3">
  <!-- Left column -->
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 d-flex flex-column gap-3">
    <!-- Card 1: header + state alert + drop/preview -->
    <div class="bg-white rounded-3 p-4 d-flex flex-column gap-4">
    <!-- Header -->
    <div>
      <h3 class="mb-1">
        {t("import.upload-title", {
          fallback: "Upload your data file",
        })}
      </h3>
      <p class="mb-0 text-body-secondary">
        {t("import.upload-description", {
          fallback:
            "Select the file that contains the list of objects you want to import. Okpan will read it and guide you through the rest.",
        })}
      </p>
    </div>

    <!-- State alert: tip when no file, success when file loaded -->
    {#if !wizard.file}
      <div class="border rounded-3 p-3 d-flex gap-2 align-items-start" style="background-image: linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) 100%), linear-gradient(90deg, #7A7A76 0%, #7A7A76 100%); border-color: #cacac8 !important;">
        <span class="d-flex align-items-center flex-shrink-0" style="padding-top: 4px;">
          <IconInfoCircleFilled size={16} />
        </span>
        <p class="mb-0 text-body">
          {t("import.new-to-okpan-tip", {
            fallback:
              "New to O\u0323kpan? We recommend starting by adding at least one institution, then importing your first dataset.",
          })}
        </p>
      </div>
    {:else}
      <div class="border rounded-3 p-3 d-flex align-items-center gap-2" style="background-image: linear-gradient(90deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.8) 100%), linear-gradient(90deg, #008060 0%, #008060 100%); border-color: #99ccbf !important;">
        <span class="d-flex align-items-center flex-shrink-0">
          <IconCircleCheckFilled size={16} />
        </span>
        <p class="mb-0 text-body flex-grow-1">
          {t("import.you-loaded-a", {
            fallback: "You loaded a",
          })}
          <span class="text-danger fw-semibold"> {wizard.file.format} </span>
          {t("import.file-named", {
            fallback: "file named",
          })}
          <span class="text-danger fw-semibold"> {wizard.file.fileName}</span>
          {#if wizard.data.length}
            <span>
              {t("import.with-rows", {
                fallback: "with {{count}} rows",
                count: wizard.data.length,
              })}
            </span>
          {/if}
        </p>
        <button class="btn btn-sm p-1 opacity-25 ms-auto" onclick={handleReupload} title={t("import.select-different-file", { fallback: "Change file" })}>
          <IconRefresh size={16} />
        </button>
      </div>
    {/if}

    <!-- Drop zone -->
    {#if !wizard.file}
      <DataFileUploadZone onSelect={async (filePath) => {
        resetImportState();
        const response = await selectParseFile({ filePath });
        if (!response) return;
        applyParsedResponse(response);
      }} />
    {/if}

    <!-- File selected: parser prompts, sheets, tabular preview -->
    {#if wizard.file}
      <TemplateAdoptionModal
        isOpen={showDetectedParserPrompt}
        presetLabel={wizard.file.detectedPreset?.label || ""}
        onConfirm={useDetectedParser}
        onDecline={declineDetectedParser}
      />

      {#if wizard.file.multiPage}
        <MultiSheetsSelection
          filePath={wizard.file.filePath}
          sheets={wizard.file.sheets}
        />
      {/if}

      {#if (wizard.file.format === "csv" || wizard.file.format === "tsv" || wizard.file.format === "xlsx" || wizard.file.tabularized) && wizard.data.length}
        <div>
          <p class="fw-semibold mb-3">
            {t("import.preview-table", { fallback: "Preview of the first rows" })}
          </p>
          <div class="border rounded-3 overflow-auto pb-4">
            <TablePreview data={wizard.data.slice(0, 25)} />
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Card 2: root selection for JSON/XML (separate card) -->
  {#if wizard.file && (wizard.file.format === "json" || wizard.file.format === "xml") && !wizard.file.tabularized && !showDetectedParserPrompt}
    <div class="bg-white rounded-3 p-4">
      <RootSelection jsonData={wizard.file.data} />
    </div>
  {/if}
  </div>

  <!-- Right column: info sidebar -->
  <div class="col-12 col-lg-4 col-xl-3">
    <div class="bg-white border rounded-3 p-4 d-flex flex-column">
      <div class="d-flex flex-column gap-3">
        <div class="flex-shrink-0">
          <IconBulb size={16} stroke={2} />
        </div>
        <div>
          <p class="fw-semibold mb-1 text-body">
            {t("import.supported-formats-title", { fallback: "What file formats are supported?" })}
          </p>
          <div class="text-body-secondary fs-7">
            <p class="mb-2">
              {t("import.supported-formats-description-p1", {
                fallback:
                  "Okpan accepts CSV, JSON, and XML files. CSV is the most common format — most museum databases and spreadsheet tools can export to it. JSON and XML are more structured formats often used by developer APIs or custom database exports.",
              })}
            </p>
            <p class="mb-0">
              {t("import.supported-formats-description-p2", {
                fallback: "Check our tutorials to know how to get data from institutions.",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
