<script>
  const { institutions } = $props();
  const headers = [
    { label: "Name", key: ["name", "content"], link: true },
    { label: "Objects", key: ["objectsCount"] },
    { label: "Assets", key: ["assetsCount"] },
  ];
  function getNestedProperty(obj, keys) {
    return keys.reduce(
      (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
      obj
    );
  }
</script>

<div class="grid">
  <div class="table-row">
    {#each headers as header}
      <span class="fw-bold">{header.label}</span>
    {/each}
  </div>

  {#each institutions as institution}
    <div class="table-row p-2 border rounded mb-1">
      {#each headers as header}
        <span>
          {#if header.link}
            <a
              href="/projects/{institution.project_id}/institutions/{institution.id}"
              >{getNestedProperty(institution, header.key)}</a
            >
          {:else}
            {getNestedProperty(institution, header.key)}
          {/if}
        </span>
      {/each}
    </div>
  {/each}
</div>

<style>
  .grid {
    width: 100%;
  }

  .table-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
  }
</style>
