<script>
  import { setContext } from "svelte";
  import ProjectHeader from "$lib/components/projects/ProjectHeader.svelte";
  let { children, data } = $props();

  let project = $state(data.project);
  setContext("project", project);
  $inspect(project);
  let projectLanguages = $derived(project?.projectLanguages || []);
  setContext("projectLanguages", projectLanguages);
  console.log("Layout setting projectLanguages context:", projectLanguages);
</script>

<ProjectHeader />

{@render children()}
