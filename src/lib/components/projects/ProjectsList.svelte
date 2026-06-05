<script>
  import ProjectChip from "$lib/components/projects//ProjectChip.svelte";

  const { projects = [] } = $props();
</script>

<div class="d-flex flex-column gap-2 w-100">
  {#each projects as project}
    <ProjectChip {project} />
  {/each}
</div>
