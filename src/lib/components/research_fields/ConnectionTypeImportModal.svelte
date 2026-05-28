<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { invalidateAll } from "$app/navigation";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { parseCsvLine, analyzeCsvHeaders, getSuggestedTypeName } from "$lib/utils/csvParser.js";

  let {
    projectId,
    languages = [],
    buttonClass = "btn btn-light border d-flex align-items-center gap-2"
  } = $props();

  const { t } = getTranslationStore();

  const SKIP_LANGUAGE_VALUE = '__skip__';

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
    filePath: "",
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
  async function openImportModal() {
    if (!window?.api?.openFileDialog || !window?.api?.readFile || !projectId || isImportingCsv) return;

    const result = await window.api.openFileDialog({
      title: t("project.import_connection_type_csv", { fallback: "Import connection type CSV" }),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
      properties: ['openFile']
    });

    if (result?.canceled || !result?.filePaths?.[0]) return;

    const fileName = result.files?.[0]?.name || result.filePaths[0].split(/[/\\]/).pop() || '';
    const suggestedName = getSuggestedTypeName(fileName);
    const csvContent = await window.api.readFile(result.filePaths[0]);
    const analysis = analyzeCsvHeaders(csvContent);

    if (!analysis.valid) {
      addToast({
        data: {
          type: "danger",
          title: t("common.import", { fallback: "Import" }),
          description: t("common.invalid-connection-type-csv", {
            fallback: "Invalid CSV format for a connection type.",
          })
        }
      });
      return;
    }

    const languageMapping = buildInitialLanguageMapping(analysis.csvLanguages);

    importModal.filePath = result.filePaths[0];
    importModal.suggestedName = suggestedName;
    importModal.typeName = suggestedName;
    importModal.csvLanguages = analysis.csvLanguages;
    importModal.languageMapping = languageMapping;
    importModal.mappingRequired = csvLanguagesDiffer(analysis.csvLanguages);
    importModal.formatError = "";
    importModal.open = true;
  }

  async function handleImportCsv() {
    if (!window?.api?.importConnectionTypeCsv || !projectId || !importModal.filePath) return;
    if (isImportingCsv) return;

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
        importModal.filePath = "";
        importModal.suggestedName = "";
        importModal.typeName = "";
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

  function closeImportModal() {
    if (isImportingCsv) return;
    importModal.open = false;
    importModal.filePath = "";
    importModal.suggestedName = "";
    importModal.typeName = "";
    importModal.csvLanguages = [];
    importModal.languageMapping = {};
    importModal.mappingRequired = false;
    importModal.formatError = "";
  }
</script>

<!-- Trigger button -->
<button class={buttonClass} onclick={openImportModal} disabled={isImportingCsv}>
  {#if isImportingCsv}
    <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
  {:else}
    <i class="bi bi-upload"></i>
  {/if}
  {t("common.import", { fallback: "Import" })}
</button>

<!-- Modal content -->
{#snippet modalHeader()}
  {t("common.import-connection-type", { fallback: "Import connection type" })}
{/snippet}

{#snippet modalBody()}
  <div class="d-flex flex-column gap-3">
    <div>
      <p class="text-muted mb-1">{t("common.selected-file", { fallback: "Selected file" })}</p>
      <div class="small text-break">{importModal.filePath}</div>
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
        {#each importModal.csvLanguages as csvCode}
          <div class="row align-items-center g-2">
            <div class="col-sm-4">
              <span class="fw-medium">{csvCode}</span>
            </div>
            <div class="col-sm-8">
              <BaseSelect
                items={projectLanguageOptionsWithSkip}
                value={importModal.languageMapping[csvCode]}
                onValueChange={(value) => updateLanguageMapping(csvCode, value)}
                placeholder={t("common.select-language", { fallback: "Select language" })}
              />
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
{/snippet}

{#snippet modalActions()}
  <BaseButton class="btn btn-secondary" onClick={closeImportModal} disabled={isImportingCsv} text={t("common.cancel", { fallback: "Cancel" })} />
  <BaseButton class="btn btn-primary" onClick={handleImportCsv} loading={isImportingCsv} disabled={!importModal.typeName.trim() || hasDuplicateLanguageMapping || !hasAtLeastOneMappedLanguage} text={t("common.import", { fallback: "Import" })} />
{/snippet}

<BaseModal bind:isOpen={importModal.open} header={modalHeader} body={modalBody} actions={modalActions} />
