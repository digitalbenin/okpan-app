<script>
  const { data } = $props();
  console.log("Data in default fields page:", data);
</script>

<div>
  <a href="/projects/{data.project.id}/data-structure/research-fields"
    >Research Fields</a
  >
  <a href="/projects/{data.project.id}/data-structure/default-fields"
    >Default Fields</a
  >
</div>
