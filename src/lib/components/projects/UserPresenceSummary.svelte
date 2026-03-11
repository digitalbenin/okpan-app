<script>
  import { onMount } from "svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";

  let { projectId = null } = $props();

  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.state;
  const currentUsername = $derived(userPresenceState.username || "Anonymous");
  const connectedPeers = $derived(userPresenceState.peers || []);
  const connectedPeersLabel = $derived(
    connectedPeers.length === 1 ? "1 connected user" : `${connectedPeers.length} connected users`
  );

  let peersDropdownOpen = $state(false);
  let isOnline = $state(true);

  onMount(() => {
    void userPresenceStore.initialize();
    
    if (typeof window !== "undefined") {
      isOnline = navigator.onLine;
      const handleOnline = () => isOnline = true;
      const handleOffline = () => isOnline = false;
      
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
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
  });
</script>

<div class="pe-3 d-flex justify-content-end align-items-center gap-2 flex-wrap position-relative">
  <div class="d-flex align-items-center gap-2 mw-100 justify-content-end">
    <div
      class="presence-avatar d-inline-flex align-items-center justify-content-center rounded-circle fw-bold flex-shrink-0 presence-avatar-own"
      style={getAvatarStyle(currentUsername)}
      title={currentUsername}
      aria-label={currentUsername}
    >
      {getInitial(currentUsername)}
    </div>
    <div class="d-flex flex-column align-items-start text-start">
      <span class="fw-semibold text-truncate" style="max-width: 180px; lh-sm">{currentUsername}</span>
      <div class="d-flex align-items-center gap-1" style="font-size: 0.7rem;">
        <span class={`rounded-circle bg-${isOnline ? 'success' : 'danger'}`} style="width: 6px; height: 6px; display: inline-block;"></span>
        <span class="text-white">{isOnline ? 'Online' : 'Offline'}</span>
      </div>
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
  :global(.peer-stack-trigger) {
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
  :global(.peer-stack-trigger:focus-visible) {
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .presence-avatar {
    width: 1.9rem;
    height: 1.9rem;
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
</style>