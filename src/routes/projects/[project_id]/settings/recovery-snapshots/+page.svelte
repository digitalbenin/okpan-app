<script>
  import ProjectRecoverySnapshotsPanel from "$lib/components/projects/ProjectRecoverySnapshotsPanel.svelte";

  const { data } = $props();
</script>

<ProjectRecoverySnapshotsPanel projectId={data.project.id} />