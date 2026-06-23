<script>
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";

  const { data } = $props();

  onMount(() => {
    const search = page.url.search || "";
    goto(`/projects/${data.project.id}/import-assets/steps${search}`, { replaceState: true });
  });
</script>
