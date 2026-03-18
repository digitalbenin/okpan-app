<script>
  import { onMount } from "svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { getAssetSyncStore } from "$lib/stores/AssetSyncStore.svelte.js";
  import { getNetworkStatusStore } from "$lib/stores/NetworkStatusStore.svelte.js";

  let { projectId = null } = $props();

  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.state;
  const currentUsername = $derived(userPresenceState.username || "Anonymous");
  const connectedPeers = $derived(userPresenceState.peers || []);
  const visibleConnectedPeers = $derived(connectedPeers.slice(0, 3));
  const hiddenConnectedPeersCount = $derived(Math.max(connectedPeers.length - 3, 0));
  const connectedPeersLabel = $derived(
    connectedPeers.length === 1 ? "1 connected user" : `${connectedPeers.length} connected users`
  );

  const syncStore = getAssetSyncStore();
  const syncState = syncStore.state;
  const networkStatusStore = getNetworkStatusStore();
  const networkStatusState = networkStatusStore.state;
  const isDownloadingAssets = $derived(
    Object.values(syncState.assets || {}).some(a => a.status === 'downloading')
  );

  let peersDropdownOpen = $state(false);
  let syncDropdownOpen = $state(false);
  let isDataSyncing = $state(false);

  const missingAssetsCount = $derived(
    Object.values(syncState.assets || {}).filter(a => a.status === 'missing').length
  );
  const downloadingAssetsCount = $derived(
    Object.values(syncState.assets || {}).filter(a => a.status === 'downloading').length
  );
  const presentAssetsCount = $derived(
    Object.values(syncState.assets || {}).filter(a => a.status === 'available' || a.status === 'seeding').length
  );
  const isOnline = $derived(networkStatusState.online);

  onMount(() => {
    void userPresenceStore.initialize();
    void networkStatusStore.initialize();
    
    let unsubscribeDataChanged = () => {};
    let syncTimeout = null;

    if (typeof window !== "undefined") {
      if (window.api?.onDataChanged) {
        unsubscribeDataChanged = window.api.onDataChanged(() => {
          isDataSyncing = true;
          if (syncTimeout) clearTimeout(syncTimeout);
          syncTimeout = setTimeout(() => {
             isDataSyncing = false;
          }, 5000);
        });
      }
      
      return () => {
        unsubscribeDataChanged();
        if (syncTimeout) clearTimeout(syncTimeout);
      };
    }
  });

  function getInitial(username) {
    return username?.trim()?.charAt(0)?.toUpperCase() || "?";
  }

  function getAvatarStyle(username) {
    let hash = 0;

    for (const char of username || "") {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      hash |= 0;
    }

    const hue = Math.abs(hash) % 360;
    return `background: hsl(${hue} 68% 45%); color: white;`;
  }

  function getPeerStackStyle(index) {
    return index === 0 ? "" : "margin-left: -0.55rem;";
  }

  $effect(() => {
    if (!projectId) {
      void userPresenceStore.setCurrentProject(null);
      return;
    }

    void userPresenceStore.setCurrentProject(projectId);
    void syncStore.init(projectId);
  });

  const syncIcon = $derived(
    !isOnline ? "bi-cloud-slash" :
    isDataSyncing ? "bi-cloud-arrow-up" :
    isDownloadingAssets ? "bi-cloud-download" :
    "bi-cloud-check"
  );

  $effect(() => {
    console.log('[UserPresenceSummary] icon state', {
      projectId,
      isOnline,
      networkSource: networkStatusState.source,
      lastChangedAt: networkStatusState.lastChangedAt,
      syncIcon,
      isDataSyncing,
      isDownloadingAssets
    });
  });
</script>

<div class="pe-3 d-flex justify-content-end align-items-center gap-2 flex-wrap position-relative">
  <div class="d-flex align-items-center gap-2 mw-100 justify-content-end">
    <BaseDropdownMenu
      bind:open={syncDropdownOpen}
      triggerClass="d-inline-flex align-items-center p-0 m-0 border-0 bg-transparent shadow-none"
      contentProps={{ style: "right: 0; left: auto; min-width: 260px; background: #fff; border: 1px solid rgba(15, 23, 42, 0.12); color: #111827; border-radius: 0.85rem; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);" }}
      side="bottom"
      align="end"
      sideOffset={8}
      alignOffset={0}
    >
      {#snippet trigger()}
        <div
          class="d-inline-flex align-items-center justify-content-center flex-shrink-0 cursor-pointer bg-transparent border-0"
          style="width: 2.2rem; height: 2.2rem;"
          title={!isOnline ? 'Offline' : isDataSyncing ? 'Syncing...' : isDownloadingAssets ? 'Downloading Assets...' : 'Online & Synced'}
          aria-label={!isOnline ? 'Offline' : isDataSyncing ? 'Syncing...' : isDownloadingAssets ? 'Downloading Assets...' : 'Online & Synced'}
        >
          <i class="bi {syncIcon} text-white d-flex align-items-center justify-content-center lh-1" style="font-size: 1.8rem;"></i>
        </div>
      {/snippet}

      {#snippet children()}
        <div class="d-flex flex-column gap-2 pt-3 px-2 sync-status-menu text-dark">
          <div class="fw-bold mb-2 pb-2 border-bottom sync-status-menu-divider">
            Sync Status: {!isOnline ? 'Offline' : isDataSyncing ? 'Synchronizing...' : isDownloadingAssets ? 'Downloading Assets...' : 'Up to Date'}
          </div>

          <div class="d-flex align-items-center justify-content-between">
            <span class="d-inline-flex align-items-center gap-2"><i class="bi bi-images"></i> Project Assets</span>
            <span class="sync-status-count rounded-pill">{presentAssetsCount}</span>
          </div>

          <div class="d-flex align-items-center justify-content-between">
            <span class="d-inline-flex align-items-center gap-2"><i class="bi bi-arrow-down-circle"></i> Downloading</span>
            <span class="sync-status-count rounded-pill">{downloadingAssetsCount}</span>
          </div>

          <div class="d-flex align-items-center justify-content-between">
            <span class="d-inline-flex align-items-center gap-2"><i class="bi bi-exclamation-triangle"></i> Missing Assets</span>
            <span class="sync-status-count rounded-pill">{missingAssetsCount}</span>
          </div>

          <div class="border-top pt-2 mt-0">
            <a
              class="btn btn-link text-primary-subtle btn-sm text-decoration-none p-0 d-inline-flex align-items-center gap-2"
              href={`/projects/${projectId}/settings/recovery-snapshots`}
              onclick={() => {
                syncDropdownOpen = false;
              }}
            >
              <i class="bi bi-clock-history"></i>
              <span>Recovery snapshots</span>
            </a>
          </div>

        </div>
      {/snippet}
    </BaseDropdownMenu>
    <div class="d-flex flex-column align-items-start text-start gap-0 justify-content-center ms-1">
      <span class="fw-semibold text-truncate" style="max-width: 180px; lh-sm">{currentUsername}</span>
    </div>
  </div>

  {#if connectedPeers.length > 0}
    <div class="vr ms-3 text-white opacity-75 align-self-stretch my-1"></div>

    <BaseDropdownMenu
      bind:open={peersDropdownOpen}
      triggerClass="d-inline-flex align-items-center p-0 border-0 bg-transparent shadow-none"
      contentProps={{ style: "right: 0; left: auto; min-width: 220px;" }}
      side="bottom"
      align="end"
      sideOffset={4}
      alignOffset={0}
    >
      {#snippet trigger()}
        <div
          class="d-inline-flex align-items-center ps-2 cursor-pointer"
          title={connectedPeersLabel}
          aria-label={connectedPeersLabel}
        >
          {#each visibleConnectedPeers as peer, index (peer.clientId)}
            <div
              class="d-inline-flex align-items-center justify-content-center rounded-circle fw-bold position-relative shadow-none text-white"
              style={`width: 2.2rem; height: 2.2rem; font-size: 0.8rem; ${getAvatarStyle(peer.username)}; ${getPeerStackStyle(index)}`}
              aria-hidden="true"
            >
              {getInitial(peer.username)}
            </div>
          {/each}
          {#if hiddenConnectedPeersCount > 0}
            <div
              class="d-inline-flex align-items-center justify-content-center rounded-circle fw-semibold position-relative shadow-none text-white border border-white border-opacity-25 bg-white bg-opacity-25 small lh-1"
              style={`width: 2.2rem; height: 2.2rem; ${getPeerStackStyle(visibleConnectedPeers.length)}`}
              aria-hidden="true"
            >
              +{hiddenConnectedPeersCount}
            </div>
          {/if}
        </div>
      {/snippet}

      {#snippet children()}
        <div class="d-flex flex-column gap-2 p-1">
          <div class="fs-7 text-uppercase text-secondary px-1" style="letter-spacing: 0.04em;">Connected users</div>
          {#each connectedPeers as peer (peer.clientId)}
            <div class="d-flex align-items-center gap-2 px-1 py-1">
              <div
                class="d-inline-flex align-items-center justify-content-center rounded-circle fw-bold flex-shrink-0 shadow-none text-white"
                style={`width: 1.7rem; height: 1.7rem; font-size: 0.75rem; ${getAvatarStyle(peer.username)}`}
                aria-hidden="true"
              >
                {getInitial(peer.username)}
              </div>
              <span class="text-nowrap">{peer.username}</span>
            </div>
          {/each}
        </div>
      {/snippet}
    </BaseDropdownMenu>
  {/if}
</div>

