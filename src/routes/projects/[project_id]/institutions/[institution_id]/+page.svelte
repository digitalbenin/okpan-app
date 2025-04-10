<script>
  import { setContext } from "svelte";
  import InstitutionOverview from "$lib/components/institutions/InstitutionOverview.svelte";
  import InstitutionItems from "$lib/components/institutions/InstitutionItems.svelte";
  const { data } = $props();
  let institution = $state(data.institution);
  setContext("institution", institution);
  let objects = $state(data.objects);
  setContext("objects", objects);
  let assets = $state(data.assets);
  setContext("assets", assets);
</script>

<InstitutionOverview></InstitutionOverview>
<InstitutionItems></InstitutionItems>
