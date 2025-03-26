<script>
  import { setContext } from "svelte";
  const { data } = $props();
  let institution = $state(data.institution);
  setContext("institution", institution);
  $inspect("institution", data);
</script>

<div>
  <h1>{institution.name.content}</h1>
  <p>{institution.location.content}</p>
  <p>Assets {data.assets.length}</p>
  <p>Objects {data.objects.length}</p>
</div>
