<script>
  import { Pagination } from "bits-ui";

  let { page = $bindable(), pageSize, count, size } = $props();
</script>

<Pagination.Root {count} perPage={pageSize} bind:page>
  {#snippet children({ pages })}
    <ul class="pagination {size ? `pagination-${size}` : ''}">
      <Pagination.PrevButton forceMount>
        {#snippet child({ props })}
          <li class="page-item" class:disabled={props.disabled}>
            <button class="page-link" {...props}>Prev</button>
          </li>
        {/snippet}
      </Pagination.PrevButton>

      {#each pages as buttonPage (buttonPage.key)}
        {#if buttonPage.type === "ellipsis"}
          <li class="page-item disabled">
            <button class="page-link">...</button>
          </li>
        {:else}
          <Pagination.Page page={buttonPage} forceMount>
            {#snippet child({ props })}
              <li
                class="page-item"
                class:active={props["data-selected"] === ""}
              >
                <button class="page-link" {...props}>{buttonPage.value}</button>
              </li>
            {/snippet}
          </Pagination.Page>
        {/if}
      {/each}

      <Pagination.NextButton forceMount>
        {#snippet child({ props })}
          <li class="page-item" class:disabled={props.disabled}>
            <button class="page-link" {...props}>Next</button>
          </li>
        {/snippet}
      </Pagination.NextButton>
    </ul>
  {/snippet}
</Pagination.Root>
