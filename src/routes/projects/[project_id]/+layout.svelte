<script>
  import { setContext } from "svelte";
  import ProjectHeader from "$lib/components/projects/ProjectHeader.svelte";
  let { children, data } = $props();

  let project = $state(data.project);
  let projectLanguages = $state(data.projectLanguages);
  let researchFields = $state(data.researchFields);
  setContext("project", project);
  setContext("projectLanguages", projectLanguages);
  setContext("researchFields", researchFields);
</script>

<ProjectHeader />

{@render children()}
