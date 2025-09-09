<script>
  import InstitutionForm from "$lib/components/institutions/InstitutionForm.svelte";

  let { data } = $props();

  // Extract languages from layout data
  const { languages } = data;
</script>

<InstitutionForm mode="create" {languages} />
