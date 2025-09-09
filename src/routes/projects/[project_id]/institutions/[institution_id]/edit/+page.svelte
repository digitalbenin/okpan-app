<script>
  import InstitutionForm from "$lib/components/institutions/InstitutionForm.svelte";

  const { data } = $props();

  // Input data from load function
  let institution = $derived(data.institution);
  let languages = $derived(data.languages);
</script>

<InstitutionForm mode="edit" {institution} {languages} />
