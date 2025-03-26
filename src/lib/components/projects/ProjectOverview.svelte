<script>
  import { getContext } from "svelte";
  const project = getContext("project");
  const cards = $derived.by(() => {
    return [
      { title: "Institutions", value: project.institutionsCount || 0 },
      { title: "Objects", value: project.objectsCount || 0 },
      { title: "Assets", value: project.assetsCount || 0 },
    ];
  });
</script>

{#snippet card(item)}
  <div class="bg-light p-3 rounded">
    <h5 class="card-title">{item.title}</h5>
    <div class="fs-3">
      {item.value}
    </div>
  </div>
{/snippet}

<div class="container-fluid mt-2">
  <div class="row">
    <div class="col-12">
      <h4>Overview</h4>
    </div>
  </div>
  <div class="row">
    {#each cards as cardItem}
      <div class="col-4">
        {@render card(cardItem)}
      </div>
    {/each}
  </div>
</div>
