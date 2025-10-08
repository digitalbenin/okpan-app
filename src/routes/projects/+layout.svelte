<script>
  import { onDestroy, setContext } from "svelte";
  import Header from "$lib/components/projects/Header.svelte";
  import Sidebar from "$lib/components/projects/Sidebar.svelte";
  import { page } from "$app/state";

  const { children } = $props();

  // (selection context moved into objects route layout)

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
    <div class="flex-grow-1 flex-shrink-1 overflow-y-auto position-relative">
      {@render children()}
    </div>
  </div>
</div>
