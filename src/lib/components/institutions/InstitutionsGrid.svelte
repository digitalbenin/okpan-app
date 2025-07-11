<script>
  const { institutions = [] } = $props();
</script>

<div class="row">
  {#each institutions as institution (institution.id)}
    <div class="col-4 mb-2">
      <a
        href={`/projects/${institution.project_id}/institutions/${institution.id}`}
      >
        {institution.name.content}
      </a>
    </div>
  {/each}
</div>
