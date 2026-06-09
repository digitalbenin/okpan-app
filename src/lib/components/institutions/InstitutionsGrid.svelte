<script>
  import InstitutionCard from "./InstitutionCard.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  let {
    institutions = [],
    page = $bindable(),
    pageSize,
    count,
  } = $props();
</script>

<div class="row">
  {#each institutions as institution (institution.id)}
    <div class="col-4 mb-3">
      <InstitutionCard {institution} />
    </div>
  {/each}
</div>
{#if count > pageSize}
  <div class="row mb-4 justify-content-end">
    <div class="col-auto">
      <BasePagination bind:page {pageSize} {count} size="sm" />
    </div>
  </div>
{/if}
