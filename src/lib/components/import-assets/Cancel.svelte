<script>
  import { goto } from "$app/navigation";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";

  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();
  let open = $state(false);

  async function cancelImport() {
    if (wizard.isCleaningUp) return;

    if (!wizard.importCompleted) {
      try {
        const result = await wizard.cleanupImportedAssets();
        if (result?.errors?.length) {
          console.warn("Some assets could not be deleted:", result.errors);
        }
      } catch (error) {
        console.error("Failed to cleanup imported assets during cancel:", error);
      }
    }

    wizard.clearFlowState();
    open = false;
    goto(`/projects/${wizard.projectId}`);
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
    {#if wizard.isCleaningUp}
      <div class="spinner-border text-danger" role="status">
        <span class="visually-hidden">{t("common.deleting", { fallback: "Deleting..." })}</span>
      </div>
    {/if}
    <button class="btn btn-success" onclick={cancelImport} disabled={wizard.isCleaningUp}>
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseAlertDialog>
