<script>
  import { slide } from "svelte/transition";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import Self from "./JsonViewer.svelte";
  let {
    node,
    isExpanded,
    toggleNode,
    isChecked,
    checkNode,
    formatValue,
    parentChecked = false,
    maxDepth,
  } = $props();

  const { t } = getTranslationStore();

  const expanded = $derived(isExpanded(node));
  const checked = $derived(isChecked(node));
  const showChildren = $derived(
    expanded && node.children && node.depth < maxDepth
  );
</script>

<div class:ms-2={node.depth}>
  <div
    class:fs-7={!node.isExpandable}
    class:border-primary={parentChecked}
    class="bg-light w-100 d-flex align-items-center p-2 mb-1 border rounded overflow-hidden"
  >
    {#if node.isExpandable}
      <div class="me-2">
        <input
          class="form-check-input"
          type="radio"
          {checked}
          onclick={(e) => {
            checkNode(node);
          }}
        />
      </div>
    {/if}
    <div
      class:fw-bold={node.isExpandable}
      class:font-monospace={!node.isExpandable}
    >
      {node.key !== null ? node.key : t("common.root", { fallback: "root" })}{#if !node.isExpandable}
        <span class="mx-1">:</span>
      {/if}
    </div>
    <div class="text-truncate">
      {#if node.type === "object"}
        <span class="badge text-bg-secondary ms-2">
          {node.size} {t("common.properties", { fallback: "properties" })}
        </span>
      {:else if node.type === "array"}
        <span class="badge text-bg-secondary ms-2">
          {node.size} {t("common.items", { fallback: "items" })}
        </span>
      {:else}
        <span
          class="font-monospace"
          class:text-danger={node.type === "string"}
          class:text-info={node.type === "number" || node.type === "boolean"}
          class:text-secondary={node.type === "null"}
        >
          {formatValue(node.value, node.type)}
        </span>
      {/if}
    </div>

    {#if node.isExpandable && node.depth !== 0}
      <div class="ms-auto">
        <button
          class="btn btn-light btn-sm"
          aria-label={t("common.toggle-node", { fallback: "Toggle node" })}
          onclick={() => node.isExpandable && toggleNode(node.pathString)}
        >
          <i class="bi bi-chevron-{expanded ? 'down' : 'right'}"></i>
        </button>
      </div>
    {/if}
  </div>

  {#if showChildren}
    <div class="border-start" transition:slide>
      {#each node.children as child}
        <Self
          node={child}
          {isExpanded}
          {toggleNode}
          {isChecked}
          {checkNode}
          {formatValue}
          parentChecked={checked}
          {maxDepth}
        />
      {/each}
    </div>
  {/if}
</div>
