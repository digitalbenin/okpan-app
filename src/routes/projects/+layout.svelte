<script>
  import { onMount, onDestroy, setContext } from "svelte";
  import Header from "$lib/components/projects/Header.svelte";
  import Sidebar from "$lib/components/projects/Sidebar.svelte";
  import DeletedEntityRedirectGuard from "$lib/components/navigation/DeletedEntityRedirectGuard.svelte";
  import { page } from "$app/state";
  import { afterNavigate } from "$app/navigation";

  const { children } = $props();

  // (selection context moved into objects route layout)

  onMount(() => {
    let reconnectTimeout;
    let reconnectRunId = 0;
    let reconnectAttemptCount = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    const stopReconnectCycle = () => {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
      reconnectAttemptCount = 0;
    };

    const runReconnectAttempt = async (projectId, runId) => {
      if (!projectId || runId !== reconnectRunId || !navigator.onLine) {
        return;
      }

      reconnectAttemptCount += 1;

      try {
        console.log("Restarting P2P discovery...", { projectId, runId });
        const result = await window.api.reconnectP2PProject(projectId);
        if (!result?.success) {
          if (runId === reconnectRunId && navigator.onLine && reconnectAttemptCount < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeout = setTimeout(() => {
              void runReconnectAttempt(projectId, runId);
            }, 4000);
          }
          return;
        }

        stopReconnectCycle();
      } catch (err) {
        console.warn('Failed to reconnect P2P:', err);
        if (runId === reconnectRunId && navigator.onLine && reconnectAttemptCount < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeout = setTimeout(() => {
            void runReconnectAttempt(projectId, runId);
          }, 4000);
        }
      }
    };

    const handleOnline = () => {
      console.log("Network online, scheduling P2P reconnect...");
      const projectId = page.params.project_id;
      if (projectId) {
        reconnectRunId += 1;
        const runId = reconnectRunId;
        stopReconnectCycle();
        reconnectTimeout = setTimeout(() => {
          void runReconnectAttempt(projectId, runId);
        }, 1000);
      }
    };
    
    const handleOffline = () => {
      console.log("Network offline, suspending P2P...");
      const projectId = page.params.project_id;
      reconnectRunId += 1;
      if (projectId) {
        stopReconnectCycle();
        window.api.suspendP2PProject(projectId).catch(err => {
          console.warn('Failed to suspend P2P:', err);
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      reconnectRunId += 1;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      stopReconnectCycle();
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
      class="flex-grow-1 flex-shrink-1 overflow-y-auto position-relative"
      bind:this={contentContainer}
    >
      {@render children()}
    </div>
  </div>
</div>
