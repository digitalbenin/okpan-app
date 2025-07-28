<script>
  import SidebarElement from "$lib/components/projects/SidebarElement.svelte";
  const { items, pathname } = $props();
</script>

<div class="w-100 d-flex flex-column fs-7 mb-3">
  {#each items as element}
    <SidebarElement {element} {pathname} />
  {/each}
</div>
