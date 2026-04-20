<script>
  import InstitutionForm from "$lib/components/institutions/InstitutionForm.svelte";
  import { back } from "$lib/utils/navigation.js";

  let { data } = $props();

  // Extract languages from layout data
  const { languages } = data;
</script>

<InstitutionForm mode="create" {languages} onCancel={back} />
