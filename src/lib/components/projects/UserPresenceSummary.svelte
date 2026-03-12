<script>
  import { onMount } from "svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { getAssetSyncStore } from "$lib/stores/AssetSyncStore.svelte.js";

  let { projectId = null } = $props();

  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.state;
  const currentUsername = $derived(userPresenceState.username || "Anonymous");
  const connectedPeers = $derived(userPresenceState.peers || []);
  const connectedPeersLabel = $derived(
    connectedPeers.length === 1 ? "1 connected user" : `${connectedPeers.length} connected users`
  );

  const syncStore = getAssetSyncStore();
  const syncState = syncStore.state;
  const isDownloadingAssets = $derived(
    Object.values(syncState.assets || {}).some(a => a.status === 'downloading')
  );

  let peersDropdownOpen = $state(false);
  let syncDropdownOpen = $state(false);
  let isOnline = $state(true);
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

  onMount(() => {
    void userPresenceStore.initialize();
    
    let unsubscribeDataChanged = () => {};
    let syncTimeout = null;

    if (typeof window !== "undefined") {
      isOnline = navigator.onLine;
      const handleOnline = () => isOnline = true;
      const handleOffline = () => isOnline = false;
      
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

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
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
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
</script>

<div class="pe-3 d-flex justify-content-end align-items-center gap-2 flex-wrap position-relative">
  <div class="d-flex align-items-center gap-2 mw-100 justify-content-end">
    <BaseDropdownMenu
      bind:open={syncDropdownOpen}
      triggerClass="btn btn-sm sync-dropdown-trigger p-0 m-0 border-0"
      contentProps={{ style: "right: 0; left: auto; min-width: 260px; background: #fff; border: 1px solid rgba(15, 23, 42, 0.12); color: #111827; border-radius: 0.85rem; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.18);" }}
      side="bottom"
      align="end"
      sideOffset={8}
      alignOffset={0}
    >
      {#snippet trigger()}
        <div
          class="sync-status-trigger d-inline-flex align-items-center justify-content-center flex-shrink-0 cursor-pointer rounded-circle"
          title={!isOnline ? 'Offline' : isDataSyncing ? 'Syncing...' : isDownloadingAssets ? 'Downloading Assets...' : 'Online & Synced'}
          aria-label={!isOnline ? 'Offline' : isDataSyncing ? 'Syncing...' : isDownloadingAssets ? 'Downloading Assets...' : 'Online & Synced'}
        >
          <i class="bi {syncIcon} sync-status-icon text-white"></i>
        </div>
      {/snippet}

      {#snippet children()}
        <div class="d-flex flex-column gap-2 p-3 sync-status-menu text-dark">
          <div class="fw-medium mb-2 pb-2 border-bottom sync-status-menu-divider">
            Sync Status: {!isOnline ? 'Offline' : isDataSyncing ? 'Synchronizing...' : isDownloadingAssets ? 'Downloading Assets...' : 'Up to Date'}
          </div>

          <div class="d-flex align-items-center justify-content-between">
            <span class="d-inline-flex align-items-center gap-2"><i class="bi bi-cloud-check"></i> Present Assets</span>
            <span class="sync-status-count rounded-pill">{presentAssetsCount}</span>
          </div>

          <div class="d-flex align-items-center justify-content-between">
            <span class="d-inline-flex align-items-center gap-2"><i class="bi bi-cloud-download"></i> Downloading</span>
            <span class="sync-status-count rounded-pill">{downloadingAssetsCount}</span>
          </div>

          <div class="d-flex align-items-center justify-content-between">
            <span class="d-inline-flex align-items-center gap-2"><i class="bi bi-cloud-slash"></i> Missing Assets</span>
            <span class="sync-status-count rounded-pill">{missingAssetsCount}</span>
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
      triggerClass="btn btn-sm peer-stack-trigger"
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
          {#each connectedPeers as peer, index (peer.clientId)}
            <div
              class="presence-avatar d-inline-flex align-items-center justify-content-center rounded-circle fw-bold presence-avatar-peer"
              style={`${getAvatarStyle(peer.username)}; ${getPeerStackStyle(index)}`}
              aria-hidden="true"
            >
              {getInitial(peer.username)}
            </div>
          {/each}
        </div>
      {/snippet}

      {#snippet children()}
        <div class="d-flex flex-column gap-2 p-1">
          <div class="fs-7 text-uppercase text-secondary px-1" style="letter-spacing: 0.04em;">Connected users</div>
          {#each connectedPeers as peer (peer.clientId)}
            <div class="d-flex align-items-center gap-2 px-1 py-1">
              <div
                class="presence-avatar d-inline-flex align-items-center justify-content-center rounded-circle fw-bold flex-shrink-0 presence-avatar-peer-overlay"
                style={getAvatarStyle(peer.username)}
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

<style>
  :global(.peer-stack-trigger),
  :global(.sync-dropdown-trigger) {
    border: 0;
    background: transparent;
    padding: 0;
    display: inline-flex;
    align-items: center;
    box-shadow: none;
  }

  :global(.peer-stack-trigger:hover),
  :global(.peer-stack-trigger:focus),
  :global(.peer-stack-trigger:active),
  :global(.peer-stack-trigger:focus-visible),
  :global(.sync-dropdown-trigger:hover),
  :global(.sync-dropdown-trigger:focus),
  :global(.sync-dropdown-trigger:active),
  :global(.sync-dropdown-trigger:focus-visible) {
    background: transparent;
    box-shadow: none;
    outline: none;
  }

  .presence-avatar {
    width: 2.2rem;
    height: 2.2rem;
    font-size: 0.8rem;
  }

  .presence-avatar-own {
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }

  .presence-avatar-peer {
    position: relative;
    box-shadow: none;
  }

  .presence-avatar-peer-overlay {
    width: 1.7rem;
    height: 1.7rem;
    font-size: 0.75rem;
    box-shadow: none;
  }

  .sync-status-trigger {
    width: 2.2rem;
    height: 2.2rem;
    border: 2px solid rgba(255, 255, 255, 0.92);
    background: rgba(255, 255, 255, 0.04);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  }

  .sync-status-icon {
    font-size: 1.05rem;
    line-height: 1;
  }

  .sync-status-menu-divider {
    border-color: rgba(15, 23, 42, 0.12) !important;
  }

  .sync-status-count {
    min-width: 2.25rem;
    padding: 0.15rem 0.55rem;
    text-align: center;
    color: #111827;
    background: rgba(15, 23, 42, 0.06);
    border: 1px solid rgba(15, 23, 42, 0.12);
  }
</style>