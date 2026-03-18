<script>
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import {
    createProjectRecoverySnapshot,
    getRecoverySnapshots,
    restoreProjectRecoverySnapshot,
  } from "$lib/stores/RecoverySnapshotsUtils.js";

  let { projectId = null } = $props();

  let snapshots = $state([]);
  let isLoading = $state(false);
  let isCreating = $state(false);
  let restoringSnapshotId = $state(null);
  let restoreDialogOpen = $state(false);
  let selectedSnapshot = $state(null);

  const automaticSnapshots = $derived(
    snapshots.filter((snapshot) => getTriggerLabel(snapshot.trigger) === "Automatic")
  );
  const manualSnapshots = $derived(
    snapshots.filter((snapshot) => getTriggerLabel(snapshot.trigger) === "Manual")
  );

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

  function getTriggerLabel(trigger) {
    switch (trigger) {
      case "session-open":
        return "Automatic";
      case "manual":
        return "Manual";
      default:
        return "Automatic";
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

  async function handleCreateSnapshot() {
    if (!projectId || isCreating || restoringSnapshotId) {
      return;
    }

    try {
      isCreating = true;
      const result = await createProjectRecoverySnapshot(
        projectId,
        "Manual recovery snapshot created from project settings.",
      );
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
    if (!snapshot?.id || restoringSnapshotId || isCreating) {
      return;
    }

    selectedSnapshot = snapshot;
    restoreDialogOpen = true;
  }

  async function handleRestoreSnapshot() {
    if (!projectId || !selectedSnapshot?.id || restoringSnapshotId) {
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
</script>

<div class="container-fluid pb-4">
  <div class="row">
    <div class="col-12 col-xl-10">
      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap pt-3 pb-2 mb-3">
        <div>
          <h1 class="h2 mb-2">Recovery snapshots</h1>
          <p class="text-muted mb-0 mw-100" style="max-width: 52rem;">
            Automatic snapshots are captured before the first sync of a shared project in each app session. You can also create manual snapshots here.
          </p>
        </div>

        <BaseButton
          text={isCreating ? "Creating..." : "Create snapshot"}
          icon="camera"
          class="btn btn-primary"
          disabled={!projectId || isCreating || !!restoringSnapshotId}
          onClick={handleCreateSnapshot}
        />
      </div>

      <div class="rounded-2 p-3 mb-4">
        <div class="fw-semibold mb-1">Recovery snapshots</div>
        <p class="mb-0 text-secondary small">
          Automatic snapshots keep the 10 most recent entries. Manual snapshots are always kept until you remove them in a future cleanup flow.
        </p>
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
      {:else if snapshots.length === 0}
        <div class="rounded-4 p-4 text-center text-secondary border border-2 bg-body-tertiary">
          No recovery snapshots are available for this project yet.
        </div>
      {:else}
        <div class="d-flex flex-column gap-3">
          <div class="row g-4 align-items-start">
            <div class="col-12 col-lg-6">
              <div class="fw-semibold mb-2">Automatic</div>
              {#if automaticSnapshots.length === 0}
                <div class="small text-secondary">No automatic snapshots yet.</div>
              {:else}
                <div class="d-flex flex-column gap-3">
                  {#each automaticSnapshots as snapshot (snapshot.id)}
                    <div class="rounded-2 p-3 p-md-4 d-flex justify-content-between gap-3 flex-wrap align-items-start border bg-white">
                      <div class="d-flex flex-column gap-2 flex-grow-1">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                          <span class="fw-semibold">{formatDate(snapshot.createdAt)}</span>
                          <span class="badge rounded-pill text-uppercase text-success-emphasis bg-success-subtle">Automatic</span>
                        </div>

                        {#if snapshot.metadata?.counts}
                          <div class="small text-secondary d-flex gap-3 flex-wrap">
                            <span>{snapshot.metadata.counts.objects || 0} objects</span>
                            <span>{snapshot.metadata.counts.institutions || 0} institutions</span>
                            <span>{snapshot.metadata.counts.assets || 0} assets</span>
                            <span>{snapshot.metadata.counts.languages || 0} languages</span>
                          </div>
                        {/if}
                      </div>

                      <BaseButton
                        text={restoringSnapshotId === snapshot.id ? "Restoring..." : "Restore"}
                        icon={restoringSnapshotId === snapshot.id ? "arrow-repeat" : "arrow-counterclockwise"}
                        class="btn btn-outline-danger btn-sm"
                        disabled={!!restoringSnapshotId || isCreating}
                        onClick={() => openRestoreDialog(snapshot)}
                      />
                    </div>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="col-12 col-lg-6">
              <div class="fw-semibold mb-2">Manual</div>
              {#if manualSnapshots.length === 0}
                <div class="small text-secondary">No manual snapshots yet.</div>
              {:else}
                <div class="d-flex flex-column gap-3">
                  {#each manualSnapshots as snapshot (snapshot.id)}
                    <div class="rounded-2 p-3 p-md-4 d-flex justify-content-between gap-3 flex-wrap align-items-start border bg-white">
                      <div class="d-flex flex-column gap-2 flex-grow-1">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                          <span class="fw-semibold">{formatDate(snapshot.createdAt)}</span>
                          <span class="badge rounded-pill text-uppercase text-success-emphasis bg-success-subtle">Manual</span>
                        </div>

                        {#if snapshot.metadata?.counts}
                          <div class="small text-secondary d-flex gap-3 flex-wrap">
                            <span>{snapshot.metadata.counts.objects || 0} objects</span>
                            <span>{snapshot.metadata.counts.institutions || 0} institutions</span>
                            <span>{snapshot.metadata.counts.assets || 0} assets</span>
                            <span>{snapshot.metadata.counts.languages || 0} languages</span>
                          </div>
                        {/if}
                      </div>

                      <BaseButton
                        text={restoringSnapshotId === snapshot.id ? "Restoring..." : "Restore"}
                        icon={restoringSnapshotId === snapshot.id ? "arrow-repeat" : "arrow-counterclockwise"}
                        class="btn btn-outline-danger btn-sm"
                        disabled={!!restoringSnapshotId || isCreating}
                        onClick={() => openRestoreDialog(snapshot)}
                      />
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

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