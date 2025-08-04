<script>
  import { goto } from "$app/navigation";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { deleteDatasource } from "$lib/stores/DatasourcesUtils.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
  let open = $state(false);
  const fetcherDatasource = createFetcher(deleteDatasource);
  //   const fetcherMapping = createFetcher(deleteMapping);
  async function cancelImport() {
    if (wizard.datasourceId) {
      await fetcherDatasource.fetch({ datasourceId: wizard.datasourceId });
    }
    if (wizard.mappingId) {
      //   await fetcherMapping.fetch({ mappingId: wizard.mappingId });
    }

    open = false;
    goto(`/projects/${wizard.projectId}/import`);
  }
</script>

<BaseAlertDialog bind:open buttonProps={{ class: "btn btn-outline-secondary" }}>
  {#snippet title()}
    {t("import.cancel-import", { fallback: "Cancel Import" })}
  {/snippet}
  {#snippet trigger()}
    {t("import.cancel", { fallback: "Cancel" })}
  {/snippet}
  {#snippet description()}
    {t("import.cancel-import-description", {
      fallback: "Are you sure you want to cancel the import?",
    })}
  {/snippet}
  {#snippet footer()}
    {#if fetcherDatasource.isLoading}
      <div class="spinner-border text-success" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    {/if}
    <button
      class="btn btn-success"
      onclick={cancelImport}
      disabled={fetcherDatasource.isLoading}
    >
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseAlertDialog>
