<script>
  import InstitutionForm from "$lib/components/institutions/InstitutionForm.svelte";
  import { invalidateAll } from "$app/navigation";
  import { back } from "$lib/utils/navigation.js";

  const { data } = $props();

  // Input data from load function
  let institution = $derived(data.institution);
  let languages = $derived(data.languages);

  async function handleSuccess() {
    // Refresh the page data so updated values show immediately
    await invalidateAll();
  }
</script>

<InstitutionForm mode="edit" {institution} {languages} onSuccess={handleSuccess} onCancel={back} />
