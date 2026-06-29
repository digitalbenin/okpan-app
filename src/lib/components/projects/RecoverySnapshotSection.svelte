<script>
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { IconTrash, IconRefresh, IconClock } from "@tabler/icons-svelte";

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

<div class="bg-white p-4 m-0 w-50">
  <div class="d-flex align-items-center justify-content-between gap-3 mb-4">
    <div class="text-uppercase">{title}</div>
    {#if headerActionText}
      <BaseButton
        text={headerActionText}
        IconComponent={headerActionIcon}
        loading={headerActionLoading}
        class="btn btn-primary my-n2"
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
            <div class="d-flex align-items-center gap-2">
              <IconClock size={16} />
              <span class="fw-semibold">{formatDate(snapshot.createdAt)}</span>
            </div>
            {#if showReason && snapshot.reason?.trim()}
              <p class="mb-2 text-dark">{snapshot.reason}</p>
            {/if}

            {#if snapshot.metadata?.counts}
              <div class="small d-flex flex-column gap-1 flex-nowrap w-100">
                <div class="d-flex gap-3 justify-content-between">
                <span class="d-block w-50">{snapshot.metadata.counts.objects || 0} objects</span>
                <span class="d-block w-50">{snapshot.metadata.counts.institutions || 0} institutions</span>
                </div>
                <div class="d-flex gap-3 justify-content-between">
                <span class="d-block w-50">{snapshot.metadata.counts.assets || 0} assets</span>
                <span class="d-block w-50">{snapshot.metadata.counts.languages || 0} languages</span>
                </div>
              </div>
            {/if}
          </div>

          <div class="d-flex flex-row w-100 justify-content-end gap-2">
            <BaseButton
              text={deletingSnapshotId === snapshot.id ? "Deleting..." : "Delete"}
              IconComponent={IconTrash}
              loading={deletingSnapshotId === snapshot.id}
              class="btn btn-outline-danger btn-sm"
              disabled={!!restoringSnapshotId || !!deletingSnapshotId || isCreating}
              onClick={() => onDelete(snapshot)}
            />
            <BaseButton
              text={restoringSnapshotId === snapshot.id ? "Restoring..." : "Restore"}
              IconComponent={IconRefresh}
              loading={restoringSnapshotId === snapshot.id}
              class="btn btn-outline-secondary btn-sm"
              disabled={!!restoringSnapshotId || !!deletingSnapshotId || isCreating}
              onClick={() => onRestore(snapshot)}
            />
          
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>