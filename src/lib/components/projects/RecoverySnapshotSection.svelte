<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  let {
    title,
    snapshots = [],
    emptyText = "No snapshots available.",
    formatDate = (value) => value ?? "Unknown date",
    restoringSnapshotId = null,
    deletingSnapshotId = null,
    isCreating = false,
    showReason = false,
    onRestore = () => {},
    onDelete = () => {},
    headerActionText = null,
    headerActionIcon = null,
    headerActionLoading = false,
    headerActionDisabled = false,
    onHeaderAction = () => {},
  } = $props();
</script>

<div class="col-12 col-lg-6">
  <div class="d-flex align-items-center justify-content-between gap-3 mb-4">
    <div class="fw-semibold">{title}</div>
    {#if headerActionText}
      <BaseButton
        text={headerActionText}
        icon={headerActionIcon}
        loading={headerActionLoading}
        class="btn btn-primary btn-sm mb-0"
        disabled={headerActionDisabled}
        onClick={onHeaderAction}
      />
    {/if}
  </div>
  {#if snapshots.length === 0}
    <div class="small text-secondary">{emptyText}</div>
  {:else}
    <div class="d-flex flex-column gap-3">
      {#each snapshots as snapshot (snapshot.id)}
        <div class="rounded-2 p-3 p-md-4 d-flex justify-content-between gap-3 flex-wrap align-items-start border bg-white">
          <div class="d-flex flex-column gap-2 flex-grow-1">
            <span class="fw-semibold">{formatDate(snapshot.createdAt)}</span>

            {#if showReason && snapshot.reason?.trim()}
              <p class="mb-2 text-dark">{snapshot.reason}</p>
            {/if}

            {#if snapshot.metadata?.counts}
              <div class="small text-secondary d-flex gap-3 flex-wrap">
                <span>{snapshot.metadata.counts.objects || 0} objects</span>
                <span>{snapshot.metadata.counts.institutions || 0} institutions</span>
                <span>{snapshot.metadata.counts.assets || 0} assets</span>
                <span>{snapshot.metadata.counts.languages || 0} languages</span>
              </div>
            {/if}
          </div>

          <div class="d-flex flex-row w-100 justify-content-end gap-2">
            
            <BaseButton
              text={deletingSnapshotId === snapshot.id ? "Deleting..." : "Delete"}
              icon="trash"
              loading={deletingSnapshotId === snapshot.id}
              class="btn btn-outline-secondary btn-sm"
              disabled={!!restoringSnapshotId || !!deletingSnapshotId || isCreating}
              onClick={() => onDelete(snapshot)}
            />
            <BaseButton
              text={restoringSnapshotId === snapshot.id ? "Restoring..." : "Restore"}
              icon={restoringSnapshotId === snapshot.id ? "arrow-repeat" : "arrow-counterclockwise"}
              class="btn btn-outline-danger btn-sm"
              disabled={!!restoringSnapshotId || !!deletingSnapshotId || isCreating}
              onClick={() => onRestore(snapshot)}
            />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>