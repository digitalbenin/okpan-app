<script>
  import { onMount } from "svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { invalidateAll } from "$app/navigation";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import DataFileUploadZone from "$lib/components/import/DataFileUploadZone.svelte";
  import { parseCsvLine, analyzeCsvHeaders, getSuggestedTypeName } from "$lib/utils/csvParser.js";
  import { IconTableImport, IconCircleCheckFilled, IconRefresh } from "@tabler/icons-svelte";

  let {
    projectId,
    languages = [],
    buttonClass = "btn btn-sm btn-primary border d-flex align-items-center gap-2"
  } = $props();

  const { t } = getTranslationStore();

  const SKIP_LANGUAGE_VALUE = '__skip__';

  // BaseSelect dropdowns must render above the modal backdrop
  let selectPortalEl = $state(null);

  onMount(() => {
    const el = document.createElement("div");
    el.style.cssText = "position: fixed; top: 0; left: 0; z-index: 1056;";
    document.body.appendChild(el);
    selectPortalEl = el;
    return () => el.remove();
  });

  // Build language options from props
  const sortedLanguages = $derived.by(() => {
    const langs = [...(languages || [])];
    langs.sort((a, b) => {
      if (a.is_default === b.is_default) return String(a.code || '').localeCompare(String(b.code || ''));
      return a.is_default === 1 ? -1 : 1;
    });
    return langs;
  });

  const projectLanguageOptions = $derived(
    sortedLanguages.map((language) => ({
      value: language.code,
      label: `${language.name || language.code} (${language.code})`
    }))
  );

  const projectLanguageOptionsWithSkip = $derived([
    { value: SKIP_LANGUAGE_VALUE, label: t("common.none", { fallback: "None" }) },
    ...projectLanguageOptions
  ]);

  // Import state
  let isImportingCsv = $state(false);
  let importModal = $state({
    open: false,
    step: "prepare",
    filePath: "",
    fileName: "",
    suggestedName: "",
    typeName: "",
    csvLanguages: [],
    languageMapping: {},
    mappingRequired: false,
    formatError: ""
  });

  // Derived validation state
  const hasDuplicateLanguageMapping = $derived.by(() => {
    const values = Object.values(importModal.languageMapping || {})
      .filter((value) => value && value !== SKIP_LANGUAGE_VALUE);
    return new Set(values).size !== values.length;
  });

  const hasAtLeastOneMappedLanguage = $derived.by(() => {
    const values = Object.values(importModal.languageMapping || {});
    return values.some((value) => value && value !== SKIP_LANGUAGE_VALUE);
  });

  const isConfirmStep = $derived(importModal.step === "confirm");

  const canImport = $derived(
    isConfirmStep &&
    Boolean(importModal.typeName.trim()) &&
    !hasDuplicateLanguageMapping &&
    hasAtLeastOneMappedLanguage
  );

  // Helper functions
  function buildInitialLanguageMapping(csvLanguages) {
    return Object.fromEntries(csvLanguages.map((csvCode) => [
      csvCode,
      projectLanguageOptions.some((language) => language.value === csvCode) ? csvCode : SKIP_LANGUAGE_VALUE
    ]));
  }

  function normalizeSelectValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return normalizeSelectValue(value[0]);
    if (value && typeof value === 'object') {
      if (typeof value.value === 'string') return value.value;
      if (typeof value.id === 'string') return value.id;
    }
    return '';
  }

  function csvLanguagesDiffer(csvLanguages) {
    if (csvLanguages.length !== projectLanguageOptions.length) return true;
    const projectCodes = new Set(projectLanguageOptions.map((language) => language.value));
    return csvLanguages.some((csvCode) => !projectCodes.has(csvCode));
  }

  function updateLanguageMapping(csvCode, projectCode) {
    importModal.languageMapping = {
      ...importModal.languageMapping,
      [csvCode]: normalizeSelectValue(projectCode)
    };
  }

  // Modal actions
  function openImportModal() {
    if (isImportingCsv) return;
    clearFileSelection();
    importModal.open = true;
  }

  async function handleFileSelect(filePath) {
    if (!filePath || isImportingCsv) return;

    const fileName = filePath.split(/[/\\]/).pop() || filePath;
    importModal.formatError = "";

    try {
      const csvContent = await window.api.readFile(filePath);
      const analysis = analyzeCsvHeaders(csvContent);

      if (!analysis.valid) {
        clearFileSelection();
        importModal.formatError = t("common.invalid-connection-type-csv", {
          fallback: "Invalid CSV format for a connection type.",
        });
        return;
      }

      const suggestedName = getSuggestedTypeName(fileName);

      importModal.filePath = filePath;
      importModal.fileName = fileName;
      importModal.suggestedName = suggestedName;
      importModal.typeName = suggestedName;
      importModal.csvLanguages = analysis.csvLanguages;
      importModal.languageMapping = buildInitialLanguageMapping(analysis.csvLanguages);
      importModal.mappingRequired = csvLanguagesDiffer(analysis.csvLanguages);
      importModal.step = "confirm";
    } catch (error) {
      console.error('Error reading connection type CSV:', error);
      clearFileSelection();
      importModal.formatError = error?.message ||
        t("common.invalid-connection-type-csv", {
          fallback: "Invalid CSV format for a connection type.",
        });
    }
  }

  async function handleDownloadTemplate() {
    if (!window?.api?.exportConnectionTypeCsvTemplate || !projectId) return;

    try {
      const result = await window.api.exportConnectionTypeCsvTemplate({ projectId });
      if (result?.canceled) return;

      addToast({
        data: {
          type: "success",
          title: t("common.download", { fallback: "Download" }),
          description: t("connections.template-downloaded", { fallback: "The CSV template has been saved." })
        }
      });
    } catch (error) {
      console.error('Error exporting connection type CSV template:', error);
      addToast({
        data: {
          type: "danger",
          title: t("common.download", { fallback: "Download" }),
          description: error?.message || t("common.something-went-wrong", { fallback: "Something went wrong." })
        }
      });
    }
  }

  async function handleImportCsv() {
    if (isImportingCsv || !isConfirmStep || !canImport) return;
    if (!window?.api?.importConnectionTypeCsv || !projectId || !importModal.filePath) return;

    const typeName = importModal.typeName.trim();
    const plainLanguageMapping = Object.fromEntries(
      Object.entries(importModal.languageMapping || {}).map(([csvCode, projectCode]) => [
        csvCode,
        normalizeSelectValue(projectCode)
      ])
    );
    if (!typeName) return;

    isImportingCsv = true;
    try {
      const result = await window.api.importConnectionTypeCsv({
        projectId,
        filePath: importModal.filePath,
        connectionTypeName: typeName,
        languageMapping: plainLanguageMapping
      });

      if (result?.success) {
        addToast({
          data: {
            type: "success",
            title: t("common.import", { fallback: "Import" }),
            description: t("common.import-success", { fallback: "Connections imported successfully." })
          }
        });
        importModal.open = false;
        clearFileSelection();
        await invalidateAll();
        return;
      }

      console.error('Connection type CSV import failed:', {
        result,
        languageMapping: plainLanguageMapping,
        filePath: importModal.filePath
      });

      addToast({
        data: {
          type: "danger",
          title: t("common.import", { fallback: "Import" }),
          description:
            result?.error ||
            t("common.invalid-connection-type-csv", {
              fallback: "Invalid CSV format for a connection type.",
            })
        }
      });
    } catch (error) {
      console.error('Error importing connection type CSV:', error);
      addToast({
        data: {
          type: "danger",
          title: t("common.import", { fallback: "Import" }),
          description:
            error?.message ||
            t("common.invalid-connection-type-csv", {
              fallback: "Invalid CSV format for a connection type.",
            })
        }
      });
    } finally {
      isImportingCsv = false;
    }
  }

  function clearFileSelection() {
    importModal.step = "prepare";
    importModal.filePath = "";
    importModal.fileName = "";
    importModal.suggestedName = "";
    importModal.typeName = "";
    importModal.csvLanguages = [];
    importModal.languageMapping = {};
    importModal.mappingRequired = false;
    importModal.formatError = "";
  }

  function closeImportModal() {
    if (isImportingCsv) return;
    importModal.open = false;
    clearFileSelection();
  }
</script>

<!-- Trigger button -->
<button class={buttonClass} onclick={openImportModal} disabled={isImportingCsv}>
  {#if isImportingCsv}
    <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
  {:else}
      <IconTableImport size={16} />
  {/if}
  {t("connections.import", { fallback: "Import" })}
</button>

<!-- Modal content -->
{#snippet modalHeader()}
  {t("connections.import-connection", { fallback: "Import connection" })}
{/snippet}

{#snippet modalBody()}
  {#if isConfirmStep}
    <div class="d-flex flex-column gap-4">
      <div class="alert alert-success d-flex align-items-start gap-2 mb-0" role="alert">
        <IconCircleCheckFilled size={16} class="mt-1" />
        <div class="flex-grow-1">
          {t("connections.import-file-valid", {
            fallback: "You loaded the file {{fileName}} and it seems valid.",
            fileName: importModal.fileName
          })}
        </div>
        <button
          type="button"
          class="btn btn-sm btn-link text-body p-0 border-0"
          title={t("import.select-different-file", { fallback: "Change file" })}
          onclick={clearFileSelection}
        >
          <IconRefresh size={16} />
        </button>
      </div>

      <div>
        <label class="form-label" for="connection-type-name-input">
          {t("common.connection-type-name", { fallback: "Connection type name" })}
        </label>
        <BaseInput
          id="connection-type-name-input"
          bind:value={importModal.typeName}
          placeholder={importModal.suggestedName || t("common.connection-type-name", { fallback: "Connection type name" })}
        />
      </div>

      {#if importModal.mappingRequired}
        <div class="border rounded p-3 bg-light-subtle d-flex flex-column gap-3">
          <div>
            <p class="mb-1 fw-semibold">{t("common.map-csv-languages", { fallback: "Map CSV languages" })}</p>
            <p class="mb-0 text-muted small">
              {t("common.map-csv-languages-description", { fallback: "This CSV uses different language columns than the current project. Choose which project language each CSV language should import into." })}
            </p>
          </div>
          {#each importModal.csvLanguages as csvCode (csvCode)}
            <div class="row align-items-center g-2">
              <div class="col-sm-4">
                <span class="fw-medium">{csvCode}</span>
              </div>
              <div class="col-sm-8">
                {#if selectPortalEl}
                  <BaseSelect
                    items={projectLanguageOptionsWithSkip}
                    value={importModal.languageMapping[csvCode]}
                    onValueChange={(value) => updateLanguageMapping(csvCode, value)}
                    placeholder={t("common.select-language", { fallback: "Select language" })}
                    portalProps={{ to: selectPortalEl }}
                  />
                {/if}
              </div>
            </div>
          {/each}
          {#if hasDuplicateLanguageMapping}
            <div class="text-danger small">
              {t("common.unique-language-mapping", { fallback: "Each CSV language must map to a different project language." })}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {:else}
    <div class="d-flex flex-column gap-4">
      <div>
        <h3 class="fw-normal mb-2">
          {t("connections.prepare-csv-title", { fallback: "Prepare the CSV for connections" })}
        </h3>
        <ul class="mb-0">
          <li>
            {t("connections.prepare-csv-download", { fallback: "Download" })}
            <button
              type="button"
              class="btn btn-link p-0 align-baseline text-decoration-underline"
              onclick={handleDownloadTemplate}
            >
              {t("connections.prepare-csv-template", { fallback: "the template" })}
            </button>
            {t("connections.prepare-csv-download-suffix", { fallback: "in tabular format" })}
          </li>
          <li>{t("connections.prepare-csv-one-row", { fallback: "Use one row per connection" })}</li>
          <li>{t("connections.prepare-csv-language-columns", { fallback: "Columns you can translate carry the language at the end of the name — option_en for English, option_it for Italian." })}</li>
        </ul>
      </div>

      <DataFileUploadZone acceptedFormats={["csv"]} onSelect={handleFileSelect} />
      {#if importModal.formatError}
        <div class="alert alert-danger mb-0" role="alert">{importModal.formatError}</div>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet modalActions()}
  <BaseButton class="btn btn-secondary" onClick={closeImportModal} disabled={isImportingCsv} text={t("common.cancel", { fallback: "Cancel" })} />
  {#if isConfirmStep}
    <BaseButton class="btn btn-primary" onClick={handleImportCsv} loading={isImportingCsv} disabled={!canImport} text={t("connections.import-data", { fallback: "Import data" })} />
  {:else}
    <button type="button" class="btn btn-primary" disabled>
      {t("connections.import-data", { fallback: "Import data" })}
    </button>
  {/if}
{/snippet}

<BaseModal bind:isOpen={importModal.open} header={modalHeader} body={modalBody} actions={modalActions} />
