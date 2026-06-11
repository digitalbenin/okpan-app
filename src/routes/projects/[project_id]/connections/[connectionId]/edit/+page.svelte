<script>
  import { goto } from "$app/navigation";
  import ConnectionTypeForm from "$lib/components/research_fields/ConnectionTypeForm.svelte";

  const { data } = $props();

  function handleBack() {
    goto(`/projects/${data.project.id}/connections/${data.researchField.id}`);
  }
</script>

<ConnectionTypeForm
  researchField={data.researchField}
  languages={data.languages}
  projectId={data.project.id}
  onBack={handleBack}
/>
