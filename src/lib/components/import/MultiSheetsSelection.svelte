<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { spreadSheetSelection } from "$lib/api/ImportApi.js";

  const { filePath, sheets } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  let isOpen = $state(true);
  let selectedSheet = $state(null);
  let loading = $state(false);

  async function confirm() {
    if (!selectedSheet || loading) return;
    loading = true;
    try {
      const response = await spreadSheetSelection({ sheetName: selectedSheet, filePath });
      wizard.file = { ...wizard.file, ...response };

      if (wizard.file.format === "xlsx" && !wizard.file.multiPage) {
        wizard.data = wizard.file.data;
        wizard.nextEnabled = true;
      }
      isOpen = false;
    } catch (e) {
      console.error("Sheet selection failed:", e);
    } finally {
      loading = false;
    }
  }
</script>

<BaseModal
  bind:isOpen
  size="md"
  dialogStyle="max-width: 480px;"
  contentStyle="border-radius: 8px;"
>
  {#snippet header()}
    {t("import.select-sheet-title", { fallback: "Select the sheet you want to import" })}
  {/snippet}

  {#snippet body()}
    <p class="text-body mb-3">
      <span class="fw-semibold">{sheets.length} {t("import.sheets-detected", { fallback: "sheets detected" })}</span>
      <span> — {t("import.sheets-detected-hint", { fallback: "select the sheet you want to import." })}</span>
    </p>

    <div class="border rounded-3 overflow-hidden">
      {#each sheets as sheet, i}
        {@const isSelected = selectedSheet === sheet}
        <button
          class="w-100 d-flex gap-2 align-items-center p-3 border-0 text-start"
          class:border-bottom={i < sheets.length - 1}
          style="background: {isSelected ? '#cce6df' : 'white'}; cursor: pointer;"
          onclick={() => selectedSheet = sheet}
        >
          <div class="d-flex align-items-center py-1 flex-shrink-0">
            <div
              class="rounded-2 d-flex align-items-center justify-content-center"
              class:bg-success={isSelected}
              class:border={!isSelected}
              style="width: 16px; height: 16px; {!isSelected ? 'border-color: #eaebe7;' : ''}"
            >
              {#if isSelected}
                <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
              {/if}
            </div>
          </div>
          <span class="text-body">{sheet}</span>
        </button>
      {/each}
    </div>
  {/snippet}

  {#snippet actions()}
    <button
      class="btn btn-primary btn-sm"
      disabled={!selectedSheet || loading}
      onclick={confirm}
    >
      {#if loading}
        <span class="spinner-border spinner-border-sm me-1" role="status"></span>
      {/if}
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseModal>
