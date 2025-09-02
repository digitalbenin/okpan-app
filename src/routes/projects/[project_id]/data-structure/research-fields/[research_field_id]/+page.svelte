<script>
  import ResearchFieldForm from "$lib/components/research_fields/ResearchFieldForm.svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";

  let { data } = $props();

  // Extract data
  const { researchField, languages } = data;

  // Handle successful edit
  function handleSuccess() {
    // Navigate back to research fields list
    goto(`/projects/${$page.params.project_id}/data-structure/research-fields`);
  }

  // Handle cancel
  function handleCancel() {
    // Navigate back to research fields list
    goto(`/projects/${$page.params.project_id}/data-structure/research-fields`);
  }
</script>

<div class="container-fluid my-4">
  <ResearchFieldForm
    {languages}
    mode="edit"
    initialData={researchField}
    projectId={$page.params.project_id}
    onSuccess={handleSuccess}
    onCancel={handleCancel}
  />
</div>
