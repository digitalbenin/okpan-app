<script>
  import { setContext } from "svelte";
  import InstitutionOverview from "$lib/components/institutions/InstitutionOverview.svelte";
  import InstitutionItems from "$lib/components/institutions/InstitutionItems.svelte";

  const { data } = $props();
  // Extract all needed data from the load function
  const { institution, objects, assets, projectId, institutionId } = data;

  // Pass data to children via context
  setContext("institution", institution);
  setContext("objects", objects);
  setContext("assets", assets);
  setContext("projectId", projectId);
  setContext("institutionId", institutionId);
</script>

<InstitutionOverview />
<InstitutionItems />
