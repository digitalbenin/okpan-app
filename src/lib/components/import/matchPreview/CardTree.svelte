<script>
  import Self from "./CardTree.svelte";
  import Card from "./Card.svelte";
  const { node, matchingSuggestions, fields } = $props();
  const hasChildren = $derived(node.analysis ? true : false);
  const children = $derived.by(() => {
    if (hasChildren) {
      return Object.keys(node.analysis).sort();
    }
    return [];
  });

  const matchingSuggestion = $derived.by(() => {
    return matchingSuggestions?.find((s) => s.csvField === node.pathString);
  });

  const values = $derived.by(() => {
    return node.values.map((item) => {
      if (Array.isArray(item.value) && !item.value.length) {
        return "null";
      }
      return item.value || "null";
    });
  });

  const i = $derived(
    fields.findIndex((field) => field === node.pathString) + 1
  );
  const tot = $derived(fields.length);
</script>

<div class:ms-2={node.depth > 1} class="mb-2">
  {#if hasChildren}
    {#if node.pathString}
      <div
        class="bg-white border px-3 py-2 mb-2 rounded fw-bold text-muted text-break"
      >
        {node.pathString || "root"}
      </div>
    {/if}
    {#each children as field (field)}
      <div class:border-start={node.depth > 0}>
        <Self
          node={node.analysis[field]}
          {matchingSuggestions}
          {fields}
        ></Self>
      </div>
    {/each}
  {:else}
    <Card field={node.pathString} {values} {matchingSuggestion} {i} {tot} />
  {/if}
</div>
