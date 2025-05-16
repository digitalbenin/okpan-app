<script>
  import InstitutionOverview from "$lib/components/institutions/InstitutionOverview.svelte";
  import InstitutionItems from "$lib/components/institutions/InstitutionItems.svelte";

  const { data } = $props();
  // Extract all needed data from the load function
</script>

<div class="p-3">
  <InstitutionOverview />
  <InstitutionItems />
</div>
