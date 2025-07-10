<script>
  import Header from "$lib/components/projects/Header.svelte";
  import Sidebar from "$lib/components/projects/Sidebar.svelte";

  const { children } = $props();
</script>

<div class="d-flex flex-column vh-100">
  <div class="flex-grow-0 flex-shrink-0">
    <Header />
  </div>

  <div class="flex-grow-1 flex-shrink-1 d-flex overflow-hidden">
    <div class="flex-grow-0 flex-shrink-0">
      <Sidebar />
    </div>
    <div class="flex-grow-1 flex-shrink-1 overflow-y-auto">
      {@render children()}
    </div>
  </div>
</div>
