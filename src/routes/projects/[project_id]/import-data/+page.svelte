<script>
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { queryParameters, ssp } from "sveltekit-search-params";

  const { data } = $props();

  // Read institution_id from query params and preserve it when navigating to steps
  const params = queryParameters({
    institution_id: ssp.string(undefined)
  });

  onMount(() => {
    const query = params.institution_id
      ? "?institution_id=" + encodeURIComponent(params.institution_id)
      : "";
    goto("/projects/" + data.project.id + "/import-data/steps" + query);
  });
</script>
