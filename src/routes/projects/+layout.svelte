<script>
  import { onMount } from "svelte";
  import Header from "$lib/components/projects/Header.svelte";
  import Sidebar from "$lib/components/projects/Sidebar.svelte";
  import DeletedEntityRedirectGuard from "$lib/components/navigation/DeletedEntityRedirectGuard.svelte";
  import { getNetworkStatusStore } from "$lib/stores/NetworkStatusStore.svelte.js";
  import { createP2PReconnectManager } from "$lib/utils/P2PReconnectManager.js";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";

  const { children } = $props();
  const networkStatusStore = getNetworkStatusStore();

  const p2pReconnect = createP2PReconnectManager(
    networkStatusStore.networkStatusState,
    () => page.params.project_id
  );

  onMount(() => {
    void networkStatusStore.initialize();
    return () => p2pReconnect.destroy();
  });

  // Hide sidebar in explorer route
  const hideSidebar = $derived(
    page.url.pathname.startsWith(`/projects/${page.params.project_id}/explorer`)
  );

  let contentContainer;
  afterNavigate(() => {
    contentContainer?.scrollTo({ top: 0, behavior: "auto" });
  });
</script>

<div class="d-flex flex-column vh-100 bg-gray-200">
  <DeletedEntityRedirectGuard />
  <div class="flex-grow-0 flex-shrink-0">
    <Header />
  </div>

  <div class="flex-grow-1 flex-shrink-1 d-flex overflow-hidden">
    <div class="flex-grow-0 flex-shrink-0">
      {#if !hideSidebar}
        <Sidebar />
      {/if}
    </div>
    <div
      class="flex-grow-1 flex-shrink-1 overflow-y-auto position-relative pt-4 px-4 pb-0"
      bind:this={contentContainer}
    >
      {@render children()}
    </div>
  </div>
</div>
