<script>
  import { queryParameters, ssp } from "sveltekit-search-params";
  import InstitutionOverview from "$lib/components/institutions/InstitutionOverview.svelte";
  import InstitutionItems from "$lib/components/institutions/InstitutionItems.svelte";

  const params = queryParameters({
    iView: ssp.string("objects"),
  });
</script>

<div class="p-3">
  <InstitutionOverview />
  <InstitutionItems />
</div>
