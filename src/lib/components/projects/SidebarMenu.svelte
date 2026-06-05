<script>
  import SidebarElement from "$lib/components/projects/SidebarElement.svelte";
  const { items, pathname, disabled } = $props();
</script>

  <div class="w-100 d-flex flex-column fs-7">
  {#each items as element}
    <SidebarElement {element} {pathname} disabled={element.disabled} />
  {/each}
</div>
