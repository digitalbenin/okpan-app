<script>
  import { onMount, onDestroy, setContext } from "svelte";
  import Header from "$lib/components/projects/Header.svelte";
  import Sidebar from "$lib/components/projects/Sidebar.svelte";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";

  const { children } = $props();

  // (selection context moved into objects route layout)

  onMount(() => {
    let reconnectTimeout;
    const handleOnline = () => {
      console.log("Network online, scheduling P2P reconnect...");
      const projectId = page.params.project_id;
      if (projectId) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(() => {
          console.log("Executing delayed P2P reconnect...");
          window.api.reconnectP2PProject(projectId).catch(err => {
            console.warn('Failed to reconnect P2P:', err);
          });
        }, 2000);
      }
    };
    
    const handleOffline = () => {
      console.log("Network offline, suspending P2P...");
      const projectId = page.params.project_id;
      if (projectId) {
        clearTimeout(reconnectTimeout);
        window.api.suspendP2PProject(projectId).catch(err => {
          console.warn('Failed to suspend P2P:', err);
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimeout(reconnectTimeout);
    };
  });

  // Clear project cache when leaving the projects section
  onDestroy(() => {
    try {
      window.api.clearCurrentProject();
    } catch (error) {
      console.warn("Failed to clear project cache:", error);
    }
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

<div class="d-flex flex-column vh-100">
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
      class="flex-grow-1 flex-shrink-1 overflow-y-auto position-relative"
      bind:this={contentContainer}
    >
      {@render children()}
    </div>
  </div>
</div>
