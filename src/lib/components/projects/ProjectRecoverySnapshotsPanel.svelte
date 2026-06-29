<script>
  import { watch } from "runed";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { IconCamera, IconTrash, IconRefresh } from "@tabler/icons-svelte";
  import RecoverySnapshotSection from "$lib/components/projects/RecoverySnapshotSection.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import {
    createProjectRecoverySnapshot,
    deleteProjectRecoverySnapshot,
    getRecoverySnapshots,
    restoreProjectRecoverySnapshot,
  } from "$lib/api/RecoverySnapshotsApi.js";

  let { projectId = null } = $props();

  const { t } = getTranslationStore();

  let snapshots = $state([]);
  let isLoading = $state(false);
  let isCreating = $state(false);
  let createDialogOpen = $state(false);
  let createSnapshotReason = $state("");
  let restoringSnapshotId = $state(null);
  let deletingSnapshotId = $state(null);
  let restoreDialogOpen = $state(false);
  let selectedSnapshot = $state(null);
  let deleteDialogOpen = $state(false);
  let snapshotPendingDeletion = $state(null);

  const automaticSnapshots = $derived(snapshots.filter((s) => s.trigger !== "manual"));
  const manualSnapshots = $derived(snapshots.filter((s) => s.trigger === "manual"));
  const isBusy = $derived(isCreating || !!restoringSnapshotId || !!deletingSnapshotId);

  const showError = (error) => addToast({
    data: { title: t("projects.recovery-snapshots.title", { fallback: "Recovery snapshots" }), description: error.message, type: "error" },
  });

  function formatDate(value) {
    if (!value) return t("common.unknown-date", { fallback: "Unknown date" });
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch {
      return value;
    }
  }

  async function loadSnapshots() {
    if (!projectId) { snapshots = []; return; }
    try {
      isLoading = true;
      const result = await getRecoverySnapshots(projectId);
      if (!result?.success) throw new Error(result?.error || t("projects.recovery-snapshots.load-error", { fallback: "Failed to load recovery snapshots." }));
      snapshots = result.snapshots || [];
    } catch (error) {
      console.error("Failed to load recovery snapshots:", error);
      showError(error);
    } finally {
      isLoading = false;
    }
  }

  function openCreateDialog() {
    if (!projectId || isBusy) return;
    createDialogOpen = true;
  }

  async function handleCreateSnapshot() {
    if (!projectId || isBusy) return;
    try {
      isCreating = true;
      createDialogOpen = false;
      const result = await createProjectRecoverySnapshot(projectId, createSnapshotReason.trim() || null);
      if (!result?.success) throw new Error(result?.error || t("projects.recovery-snapshots.create-error", { fallback: "Failed to create recovery snapshot." }));
      addToast({ data: {
        title: t("projects.recovery-snapshots.created-title", { fallback: "Recovery snapshot created" }),
        description: t("projects.recovery-snapshots.created-description", { fallback: "A manual rollback point is now available for this project." }),
        type: "success",
      }});
      await loadSnapshots();
    } catch (error) {
      console.error("Failed to create recovery snapshot:", error);
      showError(error);
    } finally {
      isCreating = false;
    }
  }

  function openRestoreDialog(snapshot) {
    if (!snapshot?.id || isBusy) return;
    selectedSnapshot = snapshot;
    restoreDialogOpen = true;
  }

  function openDeleteDialog(snapshot) {
    if (!snapshot?.id || isBusy) return;
    snapshotPendingDeletion = snapshot;
    deleteDialogOpen = true;
  }

  async function handleRestoreSnapshot() {
    if (!projectId || !selectedSnapshot?.id || restoringSnapshotId || deletingSnapshotId) return;
    try {
      const snapshotId = selectedSnapshot.id;
      restoringSnapshotId = snapshotId;
      restoreDialogOpen = false;
      const result = await restoreProjectRecoverySnapshot(projectId, snapshotId);
      if (!result?.success) throw new Error(result?.error || t("projects.recovery-snapshots.restore-error", { fallback: "Failed to restore recovery snapshot." }));
      addToast({ data: {
        title: t("projects.recovery-snapshots.restored-title", { fallback: "Project restored" }),
        description: t("projects.recovery-snapshots.restored-description", { fallback: "The selected snapshot has been restored and will be published to connected peers." }),
        type: "success",
      }});
      await loadSnapshots();
    } catch (error) {
      console.error("Failed to restore recovery snapshot:", error);
      showError(error);
    } finally {
      restoringSnapshotId = null;
    }
  }

  async function handleDeleteSnapshot() {
    if (!projectId || !snapshotPendingDeletion?.id || deletingSnapshotId || restoringSnapshotId) return;
    try {
      const snapshotId = snapshotPendingDeletion.id;
      deletingSnapshotId = snapshotId;
      deleteDialogOpen = false;
      const result = await deleteProjectRecoverySnapshot(projectId, snapshotId);
      if (!result?.success) throw new Error(result?.error || t("projects.recovery-snapshots.delete-error", { fallback: "Failed to delete recovery snapshot." }));
      addToast({ data: {
        title: t("projects.recovery-snapshots.deleted-title", { fallback: "Recovery snapshot deleted" }),
        description: t("projects.recovery-snapshots.deleted-description", { fallback: "The selected rollback point has been removed." }),
        type: "success",
      }});
      await loadSnapshots();
    } catch (error) {
      console.error("Failed to delete recovery snapshot:", error);
      showError(error);
    } finally {
      deletingSnapshotId = null;
    }
  }

  watch(() => projectId, (id) => {
    if (!id) { snapshots = []; return; }
    loadSnapshots();
  });

  // Clear selection state once the operation and its dialog have both closed
  watch(() => restoreDialogOpen || !!restoringSnapshotId, (isActive) => {
    if (!isActive) selectedSnapshot = null;
  });
  watch(() => deleteDialogOpen || !!deletingSnapshotId, (isActive) => {
    if (!isActive) snapshotPendingDeletion = null;
  });
  watch(() => createDialogOpen || isCreating, (isActive) => {
    if (!isActive) createSnapshotReason = "";
  });
</script>

<div class="container-fluid p-0 m-0">
 

      {#if restoringSnapshotId}
        <div class="alert alert-warning d-flex align-items-center gap-3 mb-4 border-1 border-secondary" role="status">
          <span class="spinner-border spinner-border-sm flex-shrink-0" aria-hidden="true"></span>
          <div>
            <div class="fw-semibold">{t("projects.recovery-snapshots.restoring-title", { fallback: "Restoring snapshot..." })}</div>
            <div class="small mb-0">{t("projects.recovery-snapshots.restoring-description", { fallback: "The project will briefly disconnect while the rollback is applied and republished." })}</div>
          </div>
        </div>
      {/if}

      {#if isLoading}
        <div class="d-flex align-items-center gap-2 text-secondary py-5 justify-content-center">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <span>{t("projects.recovery-snapshots.loading", { fallback: "Loading recovery snapshots..." })}</span>
        </div>
      {:else}
        <div>
          <div class="d-flex flex-row w-100 gap-4 m-0">
            <RecoverySnapshotSection
              title={t("projects.recovery-snapshots.automatic", { fallback: "Automatic" })}
              snapshots={automaticSnapshots}
              emptyText={t("projects.recovery-snapshots.no-automatic", { fallback: "No automatic snapshots yet." })}
              {formatDate}
              {restoringSnapshotId}
              {deletingSnapshotId}
              {isCreating}
              onRestore={openRestoreDialog}
              onDelete={openDeleteDialog}
            />

            <RecoverySnapshotSection
              title={t("projects.recovery-snapshots.manual", { fallback: "Manual" })}
              snapshots={manualSnapshots}
              emptyText={t("projects.recovery-snapshots.no-manual", { fallback: "No manual snapshots yet." })}
              {formatDate}
              {restoringSnapshotId}
              {deletingSnapshotId}
              {isCreating}
              showReason={true}
              onRestore={openRestoreDialog}
              onDelete={openDeleteDialog}
              headerActionText={t("projects.recovery-snapshots.create-action", { fallback: "Create snapshot" })}
              headerActionIcon={IconCamera}
              headerActionLoading={isCreating}
              headerActionDisabled={!projectId || isCreating || !!restoringSnapshotId || !!deletingSnapshotId}
              onHeaderAction={openCreateDialog}
            />
          </div>
        </div>
      {/if}

</div>

<BaseAlertDialog bind:open={createDialogOpen} size="md">
  {#snippet title()}
    {t("projects.recovery-snapshots.create-dialog.title", { fallback: "Create recovery snapshot" })}
  {/snippet}

  {#snippet description()}
    {t("projects.recovery-snapshots.create-dialog.description", { fallback: "Add an optional description for this manual snapshot." })}
  {/snippet}

  {#snippet children()}
    <BaseTextArea
      bind:value={createSnapshotReason}
      rows={4}
      maxLength={500}
      placeholder={t("projects.recovery-snapshots.create-dialog.placeholder", { fallback: "What makes this snapshot worth keeping?" })}
      disabled={isCreating}
    />
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text={t("common.cancel", { fallback: "Cancel" })}
      class="btn btn-outline-secondary"
      disabled={isCreating}
      onClick={() => (createDialogOpen = false)}
    />
    <BaseButton
      text={t("projects.recovery-snapshots.create-action", { fallback: "Create snapshot" })}
      IconComponent={IconCamera}
      loading={isCreating}
      class="btn btn-primary"
      disabled={!projectId || isCreating || !!restoringSnapshotId}
      onClick={handleCreateSnapshot}
    />
  {/snippet}
</BaseAlertDialog>

<BaseAlertDialog bind:open={deleteDialogOpen} size="md">
  {#snippet title()}
    {t("projects.recovery-snapshots.delete-dialog.title", { fallback: "Delete recovery snapshot" })}
  {/snippet}

  {#snippet description()}
    {#if snapshotPendingDeletion}
      {t("projects.recovery-snapshots.delete-dialog.description", { fallback: "Delete the snapshot from {{date}}?", date: formatDate(snapshotPendingDeletion.createdAt) })}
    {:else}
      {t("projects.recovery-snapshots.delete-dialog.description-generic", { fallback: "Delete the selected recovery snapshot?" })}
    {/if}
  {/snippet}

  {#snippet children()}
    <p class="mb-0 text-secondary small">
      {t("projects.recovery-snapshots.delete-dialog.warning", { fallback: "This permanently removes the stored rollback point and cannot be undone." })}
    </p>
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text={t("common.cancel", { fallback: "Cancel" })}
      class="btn btn-outline-secondary"
      disabled={!!deletingSnapshotId}
      onClick={() => (deleteDialogOpen = false)}
    />
    <BaseButton
      text={t("projects.recovery-snapshots.delete-action", { fallback: "Delete snapshot" })}
      IconComponent={IconTrash}
      loading={!!deletingSnapshotId}
      class="btn btn-danger"
      disabled={!snapshotPendingDeletion || !!deletingSnapshotId || !!restoringSnapshotId}
      onClick={handleDeleteSnapshot}
    />
  {/snippet}
</BaseAlertDialog>

<BaseAlertDialog bind:open={restoreDialogOpen} size="md">
  {#snippet title()}
    {t("projects.recovery-snapshots.restore-dialog.title", { fallback: "Restore recovery snapshot" })}
  {/snippet}

  {#snippet description()}
    {#if selectedSnapshot}
      {t("projects.recovery-snapshots.restore-dialog.description", { fallback: "Restore the snapshot from {{date}}?", date: formatDate(selectedSnapshot.createdAt) })}
    {:else}
      {t("projects.recovery-snapshots.restore-dialog.description-generic", { fallback: "Restore the selected recovery snapshot?" })}
    {/if}
  {/snippet}

  {#snippet children()}
    <p class="mb-0 text-secondary small">
      {t("projects.recovery-snapshots.restore-dialog.warning", { fallback: "This will replace the current local project state and re-share the restored state with connected peers." })}
    </p>
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text={t("common.cancel", { fallback: "Cancel" })}
      class="btn btn-outline-secondary"
      disabled={!!restoringSnapshotId}
      onClick={() => (restoreDialogOpen = false)}
    />
    <BaseButton
      text={restoringSnapshotId ? t("projects.recovery-snapshots.restoring-btn", { fallback: "Restoring..." }) : t("projects.recovery-snapshots.restore-action", { fallback: "Restore snapshot" })}
      IconComponent={IconRefresh}
      class="btn btn-danger"
      disabled={!selectedSnapshot || !!restoringSnapshotId}
      onClick={handleRestoreSnapshot}
    />
  {/snippet}
</BaseAlertDialog>