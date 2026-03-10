<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import AddConnectionTypeModal from "$lib/components/research_fields/AddConnectionTypeModal.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();
  const { languages } = data;
  const SKIP_LANGUAGE_VALUE = '__skip__';
  const sortedLanguages = [...(languages || [])].sort((a, b) => {
    if (a.is_default === b.is_default) return String(a.code || '').localeCompare(String(b.code || ''));
    return a.is_default === 1 ? -1 : 1;
  });
  const projectLanguageOptions = sortedLanguages.map((language) => ({
    value: language.code,
    label: `${language.name || language.code} (${language.code})`
  }));
  const projectLanguageOptionsWithSkip = [
    { value: SKIP_LANGUAGE_VALUE, label: t("common.none", { fallback: "None" }) },
    ...projectLanguageOptions
  ];
  const defaultProjectLanguageCode = sortedLanguages[0]?.code || '';
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

  // Helper for status text
  function getStatusText(field) {
    if (field.onwebsite === 1) {
      return t("common.published", { fallback: "Published" });
    }
    return t("common.not-published", { fallback: "Not published" });
  }

  function getSuggestedTypeName(fileName) {
    return String(fileName || '')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim();
  }

  function parseCsvLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    result.push(current.trim());
    return result.map((value) => value.replace(/^\uFEFF/, ''));
  }

  function analyzeCsvHeaders(csvContent) {
    const firstLine = String(csvContent || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    if (!firstLine) {
      return { valid: false, csvLanguages: [] };
    }

    const columns = parseCsvLine(firstLine);
    const optionColumns = columns.filter((column) => column.startsWith('option_'));
    const descriptionColumns = columns.filter((column) => column.startsWith('description_'));
    const allowedColumns = new Set(['connection_id', 'external_link', ...optionColumns, ...descriptionColumns]);
    const hasUnexpectedColumns = columns.some((column) => !allowedColumns.has(column));

    if (optionColumns.length === 0 || hasUnexpectedColumns) {
      return { valid: false, csvLanguages: [] };
    }

    return {
      valid: true,
      csvLanguages: Array.from(new Set([
        ...optionColumns.map((column) => column.slice('option_'.length)),
        ...descriptionColumns.map((column) => column.slice('description_'.length))
      ]))
    };
  }

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

  const hasDuplicateLanguageMapping = $derived.by(() => {
    const values = Object.values(importModal.languageMapping || {}).filter((value) => value && value !== SKIP_LANGUAGE_VALUE);
    return new Set(values).size !== values.length;
  });

  const hasAtLeastOneMappedLanguage = $derived.by(() => {
    const values = Object.values(importModal.languageMapping || {});
    return values.some((value) => value && value !== SKIP_LANGUAGE_VALUE);
  });

  async function openImportModal() {
    if (!window?.api?.openFileDialog || !window?.api?.readFile || !data?.project?.id || isImportingCsv) return;

    const result = await window.api.openFileDialog({
      title: 'Import Connection Type CSV',
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
          description: 'Invalid CSV format for a connection type.'
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
    if (!window?.api?.importConnectionTypeCsv || !data?.project?.id || !importModal.filePath) return;
    if (isImportingCsv) return;

    const typeName = importModal.typeName.trim();
    const plainLanguageMapping = Object.fromEntries(
      Object.entries(importModal.languageMapping || {}).map(([csvCode, projectCode]) => [csvCode, normalizeSelectValue(projectCode)])
    );
    if (!typeName) return;

    isImportingCsv = true;
    try {
      const result = await window.api.importConnectionTypeCsv({
        projectId: data.project.id,
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
          description: result?.error || 'Invalid CSV format for a connection type.'
        }
      });
    } catch (error) {
      console.error('Error importing connection type CSV:', error);
      addToast({
        data: {
          type: "danger",
          title: t("common.import", { fallback: "Import" }),
          description: error?.message || 'Invalid CSV format for a connection type.'
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

  function updateLanguageMapping(csvCode, projectCode) {
    importModal.languageMapping = {
      ...importModal.languageMapping,
      [csvCode]: normalizeSelectValue(projectCode)
    };
  }
</script>

<div class="container-fluid h-100 bg-light">
  <!-- Header Section -->
  <div class="row pt-3 pb-3 border-bottom mb-4 align-items-center">
    <div class="col">
      <h2 class="m-0 d-flex align-items-center gap-2">
        <i class="bi bi-share-fill text-muted"></i>
        {t("project.connection-types", { fallback: "Connection types" })}
      </h2>
    </div>
    <div class="col-auto">
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-light border d-flex align-items-center gap-2" onclick={openImportModal} disabled={isImportingCsv}>
          {#if isImportingCsv}
            <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
          {:else}
            <i class="bi bi-upload"></i>
          {/if}
          {t("common.import", { fallback: "Import" })}
        </button>
        <AddConnectionTypeModal projectId={data.project.id} languages={languages} />
      </div>
    </div>
  </div>

  <!-- Cards Grid -->
  <div class="row g-4 mx-2">
    {#each data.researchFields || [] as field (field.id)}
      <div class="col-md-4">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="card h-100 shadow-sm"
          onclick={() => goto(`/projects/${data.project.id}/connections/${field.id}`)}
          style="cursor: pointer; transition: box-shadow 0.2s;"
          onmouseenter={(e) => e.currentTarget.classList.add('shadow')}
          onmouseleave={(e) => e.currentTarget.classList.remove('shadow')}
        >
          <div class="card-body d-flex flex-column justify-content-between p-4" style="min-height: 200px;">
            <h3 class="card-title fw-normal mb-4">{field.name?.content || t("common.untitled", {fallback: "Untitled"})}</h3>
            
            <div class="mt-auto">
              <div class="d-flex align-items-center gap-2 text-muted mb-1">
                {#if field.onwebsite !== 1}
                  <i class="bi bi-eye-slash"></i>
                {:else}
                  <i class="bi bi-eye"></i>
                {/if}
                <span>{getStatusText(field)}</span>
              </div>
              <div class="text-muted">
                {field.vocabularies?.length || 0} {t("common.connections", { fallback: "connections" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}
    {#if (!data.researchFields || data.researchFields.length === 0)}
        <div class="col-12 text-center text-muted mt-4">
            {t("common.no-connections-found", { fallback: "No connection types found." })}
        </div>
    {/if}
  </div>
</div>

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
