<script>
  let { page = 1, pageCount = 1, onPageChange, size = 'sm' } = $props();

  function buildPages(current, total) {
    const pages = [];
    const count = Math.max(1, Number(total) || 1);
    const cur = Math.min(Math.max(1, Number(current) || 1), count);
    const maxButtons = 5;

    if (count <= maxButtons) {
      for (let i = 1; i <= count; i++) pages.push({ type: 'page', value: i, key: `p-${i}` });
      return pages;
    }

    let start = cur - 2;
    let end = cur + 2;
    if (start < 1) {
      end += 1 - start;
      start = 1;
    }
    if (end > count) {
      start -= end - count;
      end = count;
    }
    start = Math.max(1, start);
    end = Math.min(count, end);

    if (start > 1) {
      pages.push({ type: 'page', value: 1, key: 'p-1' });
      if (start > 2) pages.push({ type: 'ellipsis', key: 'e-start' });
    }
    for (let i = start; i <= end; i++) pages.push({ type: 'page', value: i, key: `p-${i}` });
    if (end < count) {
      if (end < count - 1) pages.push({ type: 'ellipsis', key: 'e-end' });
      pages.push({ type: 'page', value: count, key: `p-${count}` });
    }
    return pages;
  }

  function goTo(p) {
    if (!onPageChange) return;
    onPageChange(p);
    // Scroll to top after changing page
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
</script>

{#if pageCount > 0}
  <nav aria-label="Pagination">
    <ul class="pagination {size ? `pagination-${size}` : ''} mb-0">
      <!-- Prev -->
      <li class="page-item" class:disabled={page <= 1}>
        <button class="page-link" aria-label="Previous" disabled={page <= 1} onclick={() => goTo(page - 1)}>
          Prev
        </button>
      </li>

      <!-- Numbered pages with ellipses -->
      {#each buildPages(page, pageCount) as btn (btn.key)}
        {#if btn.type === 'ellipsis'}
          <li class="page-item disabled">
            <button class="page-link" tabindex="-1">...</button>
          </li>
        {:else}
          <li class="page-item" class:active={btn.value === page}>
            <button class="page-link" aria-label={`Page ${btn.value}`} onclick={() => goTo(btn.value)}>
              {btn.value}
            </button>
          </li>
        {/if}
      {/each}

      <!-- Next -->
      <li class="page-item" class:disabled={page >= pageCount}>
        <button class="page-link" aria-label="Next" disabled={page >= pageCount} onclick={() => goTo(page + 1)}>
          Next
        </button>
      </li>
    </ul>
  </nav>
{/if}