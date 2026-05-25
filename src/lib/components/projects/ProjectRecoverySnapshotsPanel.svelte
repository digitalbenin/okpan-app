<script>
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseTextArea from "$lib/components/base/BaseTextArea.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import RecoverySnapshotSection from "$lib/components/projects/RecoverySnapshotSection.svelte";
  import {
    createProjectRecoverySnapshot,
    deleteProjectRecoverySnapshot,
    getRecoverySnapshots,
    restoreProjectRecoverySnapshot,
  } from "$lib/api/RecoverySnapshotsApi.js";

  let { projectId = null } = $props();

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

  const automaticSnapshots = $derived(snapshots.filter((snapshot) => snapshot.trigger !== "manual"));
  const manualSnapshots = $derived(snapshots.filter((snapshot) => snapshot.trigger === "manual"));

  function formatDate(value) {
    if (!value) return "Unknown date";
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  async function loadSnapshots() {
    if (!projectId) {
      snapshots = [];
      return;
    }

    try {
      isLoading = true;
      const result = await getRecoverySnapshots(projectId);
      if (!result?.success) {
        throw new Error(result?.error || "Failed to load recovery snapshots.");
      }
      snapshots = result.snapshots || [];
    } catch (error) {
      console.error("Failed to load recovery snapshots:", error);
      addToast({
        data: {
          title: "Recovery snapshots",
          description: error.message,
          type: "error",
        },
      });
    } finally {
      isLoading = false;
    }
  }

  function openCreateDialog() {
    if (!projectId || isCreating || restoringSnapshotId) {
      return;
    }

    createDialogOpen = true;
  }

  async function handleCreateSnapshot() {
    if (!projectId || isCreating || restoringSnapshotId) {
      return;
    }

    try {
      isCreating = true;
      createDialogOpen = false;
      const reason = createSnapshotReason.trim();
      const result = await createProjectRecoverySnapshot(projectId, reason || null);
      if (!result?.success) {
        throw new Error(result?.error || "Failed to create recovery snapshot.");
      }

      addToast({
        data: {
          title: "Recovery snapshot created",
          description: "A manual rollback point is now available for this project.",
          type: "success",
        },
      });

      await loadSnapshots();
    } catch (error) {
      console.error("Failed to create recovery snapshot:", error);
      addToast({
        data: {
          title: "Recovery snapshots",
          description: error.message,
          type: "error",
        },
      });
    } finally {
      isCreating = false;
    }
  }

  function openRestoreDialog(snapshot) {
    if (!snapshot?.id || restoringSnapshotId || deletingSnapshotId || isCreating) {
      return;
    }

    selectedSnapshot = snapshot;
    restoreDialogOpen = true;
  }

  function openDeleteDialog(snapshot) {
    if (!snapshot?.id || restoringSnapshotId || deletingSnapshotId || isCreating) {
      return;
    }

    snapshotPendingDeletion = snapshot;
    deleteDialogOpen = true;
  }

  async function handleRestoreSnapshot() {
    if (!projectId || !selectedSnapshot?.id || restoringSnapshotId || deletingSnapshotId) {
      return;
    }

    try {
      const snapshotId = selectedSnapshot.id;
      restoringSnapshotId = snapshotId;
      restoreDialogOpen = false;

      const result = await restoreProjectRecoverySnapshot(projectId, snapshotId);
      if (!result?.success) {
        throw new Error(result?.error || "Failed to restore recovery snapshot.");
      }

      addToast({
        data: {
          title: "Project restored",
          description: "The selected snapshot has been restored and will be published to connected peers.",
          type: "success",
        },
      });

      await loadSnapshots();
    } catch (error) {
      console.error("Failed to restore recovery snapshot:", error);
      addToast({
        data: {
          title: "Recovery snapshots",
          description: error.message,
          type: "error",
        },
      });
    } finally {
      restoringSnapshotId = null;
    }
  }

  async function handleDeleteSnapshot() {
    if (!projectId || !snapshotPendingDeletion?.id || deletingSnapshotId || restoringSnapshotId) {
      return;
    }

    try {
      const snapshotId = snapshotPendingDeletion.id;
      deletingSnapshotId = snapshotId;
      deleteDialogOpen = false;

      const result = await deleteProjectRecoverySnapshot(projectId, snapshotId);
      if (!result?.success) {
        throw new Error(result?.error || "Failed to delete recovery snapshot.");
      }

      addToast({
        data: {
          title: "Recovery snapshot deleted",
          description: "The selected rollback point has been removed.",
          type: "success",
        },
      });

      await loadSnapshots();
    } catch (error) {
      console.error("Failed to delete recovery snapshot:", error);
      addToast({
        data: {
          title: "Recovery snapshots",
          description: error.message,
          type: "error",
        },
      });
    } finally {
      deletingSnapshotId = null;
    }
  }

  $effect(() => {
    void projectId;

    if (!projectId) {
      snapshots = [];
      return;
    }

    void loadSnapshots();
  });

  $effect(() => {
    if (!restoreDialogOpen && !restoringSnapshotId) {
      selectedSnapshot = null;
    }
  });

  $effect(() => {
    if (!deleteDialogOpen && !deletingSnapshotId) {
      snapshotPendingDeletion = null;
    }
  });

  $effect(() => {
    if (!createDialogOpen && !isCreating) {
      createSnapshotReason = "";
    }
  });
</script>

<div class="container-fluid pb-4">
  <div class="row">
    <div class="col-12 col-xl-10">
      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap pt-3 pb-2 mb-3">
        <div>
          <h1 class="h2 mb-2">Recovery snapshots</h1>
          <p class="mb-0">
            Automatic snapshots are captured before the first sync after opening a project in each app session. Automatic snapshots keep the 10 most recent entries. Manual snapshots are always kept until you remove them.
          </p>
        </div>
      </div>

      {#if restoringSnapshotId}
        <div class="alert alert-warning d-flex align-items-center gap-3 mb-4 border-1 border-secondary" role="status">
          <span class="spinner-border spinner-border-sm flex-shrink-0" aria-hidden="true"></span>
          <div>
            <div class="fw-semibold">Restoring snapshot...</div>
            <div class="small mb-0">The project will briefly disconnect while the rollback is applied and republished.</div>
          </div>
        </div>
      {/if}

      {#if isLoading}
        <div class="d-flex align-items-center gap-2 text-secondary py-5 justify-content-center">
          <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <span>Loading recovery snapshots...</span>
        </div>
      {:else}
        <div class="d-flex flex-column gap-3">
          <div class="row g-4 align-items-start">
            <RecoverySnapshotSection
              title="Automatic"
              snapshots={automaticSnapshots}
              emptyText="No automatic snapshots yet."
              {formatDate}
              {restoringSnapshotId}
              {deletingSnapshotId}
              {isCreating}
              onRestore={openRestoreDialog}
              onDelete={openDeleteDialog}
            />

            <RecoverySnapshotSection
              title="Manual"
              snapshots={manualSnapshots}
              emptyText="No manual snapshots yet."
              {formatDate}
              {restoringSnapshotId}
              {deletingSnapshotId}
              {isCreating}
              showReason={true}
              onRestore={openRestoreDialog}
              onDelete={openDeleteDialog}
              headerActionText="Create snapshot"
              headerActionIcon="camera"
              headerActionLoading={isCreating}
              headerActionDisabled={!projectId || isCreating || !!restoringSnapshotId || !!deletingSnapshotId}
              onHeaderAction={openCreateDialog}
            />
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<BaseAlertDialog bind:open={createDialogOpen} size="md">
  {#snippet title()}
    Create recovery snapshot
  {/snippet}

  {#snippet description()}
    Add an optional description for this manual snapshot.
  {/snippet}

  {#snippet children()}
    <div class="d-flex flex-column gap-2">
      <BaseTextArea
        bind:value={createSnapshotReason}
        rows={4}
        maxLength={500}
        placeholder="What makes this snapshot worth keeping?"
        disabled={isCreating}
      />
      
    </div>
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text="Cancel"
      class="btn btn-outline-secondary"
      disabled={isCreating}
      onClick={() => {
        createDialogOpen = false;
      }}
    />
    <BaseButton
      text="Create snapshot"
      icon="camera"
      loading={isCreating}
      class="btn btn-primary"
      disabled={!projectId || isCreating || !!restoringSnapshotId}
      onClick={handleCreateSnapshot}
    />
  {/snippet}
</BaseAlertDialog>

<BaseAlertDialog bind:open={deleteDialogOpen} size="md">
  {#snippet title()}
    Delete recovery snapshot
  {/snippet}

  {#snippet description()}
    {#if snapshotPendingDeletion}
      Delete the snapshot from {formatDate(snapshotPendingDeletion.createdAt)}?
    {:else}
      Delete the selected recovery snapshot?
    {/if}
  {/snippet}

  {#snippet children()}
    <p class="mb-0 text-secondary small">
      This permanently removes the stored rollback point and cannot be undone.
    </p>
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text="Cancel"
      class="btn btn-outline-secondary"
      disabled={!!deletingSnapshotId}
      onClick={() => {
        deleteDialogOpen = false;
      }}
    />
    <BaseButton
      text="Delete snapshot"
      icon="trash"
      loading={!!deletingSnapshotId}
      class="btn btn-danger"
      disabled={!snapshotPendingDeletion || !!deletingSnapshotId || !!restoringSnapshotId}
      onClick={handleDeleteSnapshot}
    />
  {/snippet}
</BaseAlertDialog>

<BaseAlertDialog bind:open={restoreDialogOpen} size="md">
  {#snippet title()}
    Restore recovery snapshot
  {/snippet}

  {#snippet description()}
    {#if selectedSnapshot}
      Restore the snapshot from {formatDate(selectedSnapshot.createdAt)}?
    {:else}
      Restore the selected recovery snapshot?
    {/if}
  {/snippet}

  {#snippet children()}
    <p class="mb-0 text-secondary small">
      This will replace the current local project state and re-share the restored state with connected peers.
    </p>
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text="Cancel"
      class="btn btn-outline-secondary"
      disabled={!!restoringSnapshotId}
      onClick={() => {
        restoreDialogOpen = false;
      }}
    />
    <BaseButton
      text={restoringSnapshotId ? "Restoring..." : "Restore snapshot"}
      icon={restoringSnapshotId ? "arrow-repeat" : "arrow-counterclockwise"}
      class="btn btn-danger"
      disabled={!selectedSnapshot || !!restoringSnapshotId}
      onClick={handleRestoreSnapshot}
    />
  {/snippet}
</BaseAlertDialog>