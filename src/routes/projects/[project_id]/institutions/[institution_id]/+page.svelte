<script>
  import { setContext } from "svelte";
  const { data } = $props();
  let institution = $state(data.institution);
  setContext("institution", institution);
</script>

<div>
  <h1>{institution.name.content}</h1>
  <p>{institution.location.content}</p>
  <p>Assets {data.assets.length}</p>
</div>
