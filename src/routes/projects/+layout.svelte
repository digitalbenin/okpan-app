<script>
  import { onDestroy } from "svelte";
  import Header from "$lib/components/projects/Header.svelte";
  import Sidebar from "$lib/components/projects/Sidebar.svelte";

  const { children } = $props();

  // Clear project cache when leaving the projects section
  onDestroy(() => {
    try {
      window.api.clearCurrentProject();
    } catch (error) {
      console.warn("Failed to clear project cache:", error);
    }
  });
</script>

<div class="d-flex flex-column vh-100">
  <div class="flex-grow-0 flex-shrink-0">
    <Header />
  </div>

  <div class="flex-grow-1 flex-shrink-1 d-flex overflow-hidden">
    <div class="flex-grow-0 flex-shrink-0">
      <Sidebar />
    </div>
    <div class="flex-grow-1 flex-shrink-1 overflow-y-auto position-relative">
      {@render children()}
    </div>
  </div>
</div>
