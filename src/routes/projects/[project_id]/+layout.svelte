<script>
  import { setContext } from "svelte";
  import ProjectHeader from "$lib/components/projects/ProjectHeader.svelte";
  let { children, data } = $props();

  let project = $state(data.project);
  setContext("project", project);
</script>

<ProjectHeader />

{@render children()}
