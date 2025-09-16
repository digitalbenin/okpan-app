<script>
  import { Pagination } from "bits-ui";
  import { tick } from "svelte";

  let { page = $bindable(), pageSize, count, size, onChange = null } = $props();

  async function notify(nextPage) {
    if (typeof onChange === "function") {
      // Wait for bits-ui to perform its own internal updates; we still pass nextPage explicitly
      await tick();
      try {
        onChange(nextPage);
      } catch (e) {
        console.error("BasePagination onChange error:", e);
      }
    }
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function maxPages() {
    if (!count || !pageSize) return 1;
    return Math.max(1, Math.ceil(count / pageSize));
  }
</script>

<Pagination.Root {count} perPage={pageSize} bind:page>
  {#snippet children({ pages })}
    <ul class="pagination {size ? `pagination-${size}` : ''} mb-0">
      <Pagination.PrevButton forceMount>
        {#snippet child({ props })}
          <li class="page-item" class:disabled={props.disabled}>
            <button
              class="page-link"
              {...props}
              on:click={() => notify(clamp(page - 1, 1, maxPages()))}
            >Prev</button>
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
                <button
                  class="page-link"
                  {...props}
                  on:click={() => notify(buttonPage.value)}
                >{buttonPage.value}</button>
              </li>
            {/snippet}
          </Pagination.Page>
        {/if}
      {/each}

      <Pagination.NextButton forceMount>
        {#snippet child({ props })}
          <li class="page-item" class:disabled={props.disabled}>
            <button
              class="page-link"
              {...props}
              on:click={() => notify(clamp(page + 1, 1, maxPages()))}
            >Next</button>
          </li>
        {/snippet}
      </Pagination.NextButton>
    </ul>
  {/snippet}
</Pagination.Root>
