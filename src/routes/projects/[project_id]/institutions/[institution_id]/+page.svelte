<script>
  import { setContext } from "svelte";
  import InstitutionOverview from "$lib/components/institutions/InstitutionOverview.svelte";
  import InstitutionItems from "$lib/components/institutions/InstitutionItems.svelte";
  import { invalidateAll, invalidate } from "$app/navigation";

  const { data } = $props();
  // Extract all needed data from the load function
  let {
    institution,
    objects,
    assets,
    datasources,
    projectId,
    institutionId,
    projectLanguages,
  } = data;

  // Pass data to children via context
  setContext("institution", institution);
  setContext("objects", objects);
  setContext("assets", assets);
  setContext("datasources", datasources);
  setContext("projectId", projectId);
  setContext("institutionId", institutionId);
  setContext("projectLanguages", projectLanguages);

  const invalidateData = async () => {
    console.log("invalidating data");
    await invalidateAll();
  };
</script>

<InstitutionOverview />
<InstitutionItems onActionCompletesDataRefresh={invalidateData} />
