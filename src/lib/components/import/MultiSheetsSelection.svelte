<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { spreadSheetSelection } from "$lib/stores/ImportUtils.js";
  import BaseRadioGroup from "$lib/components/base/BaseRadioGroup.svelte";

  const { filePath, sheets } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  let value = $state(null);

  const options = sheets.map((sheet) => ({
    label: sheet,
    value: sheet,
  }));

  async function handleSheetSelect(sheetName) {
    const response = await spreadSheetSelection({ sheetName, filePath });
    //check for errors, usefetcher?

    wizard.file = { ...wizard.file, ...response };

    if (wizard.file.format === "xlsx" && !wizard.file.multiPage) {
      wizard.data = wizard.file.data; // Store the parsed data in the wizard context
      wizard.nextEnabled = true; // Enable next step after file selection
    }
  }
</script>

<div class="border rounded p-3 mb-3">
  <div class="alert alert-warning">
    <i class="bi bi-exclamation-triangle"></i>
    {t("import.multi-sheet-warning", {
      fallback: "Please select a sheet to import.",
    })}
  </div>

  <div>
    <BaseRadioGroup items={options} bind:value />
    <button
      class="btn btn-primary mt-2"
      disabled={!value}
      onclick={() => handleSheetSelect(value)}
    >
      {t("import.select-sheet", {
        fallback: "Select Sheet",
      })}
    </button>
  </div>
</div>
