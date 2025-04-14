<script>
  const { text, row } = $props();
</script>

<a
  class="text-dark text-decoration-none fs-5"
  href="/projects/{row.project_id}/institutions/{row.id}">{text}</a
>
