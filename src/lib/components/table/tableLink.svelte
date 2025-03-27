<script>
  const { text, row } = $props();
</script>

<a href="/projects/{row.project_id}/institutions/{row.id}">{text}</a>
