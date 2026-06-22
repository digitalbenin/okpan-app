<script>
  import { slide } from "svelte/transition";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import Self from "./JsonViewer.svelte";
  import { IconCircleMinus, IconCirclePlus } from "@tabler/icons-svelte";
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

<div class="w-100">
  <div
    class:fs-7={!node.isExpandable}
    class:border-primary={parentChecked}
    class="bg-gray-200 w-100 d-flex align-items-baseline p-2 mb-1 border rounded "
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
    <div
      class="min-w-0"
      class:text-truncate={node.isExpandable}
      class:text-break={!node.isExpandable}
    >
      {#if node.type === "object"}
        <span class="badge fw-normal text-bg-secondary ms-2 p-2">
          {node.size} {t("common.properties", { fallback: "properties" })}
        </span>
      {:else if node.type === "array"}
        <span class="badge fw-normal text-bg-secondary ms-2 p-2">
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
          class="btn btn-white btn-sm w-100"
          aria-label={t("common.toggle-node", { fallback: "Toggle node" })}
          onclick={() => node.isExpandable && toggleNode(node.pathString)}
        >
          {#if expanded}
            <IconCircleMinus size={16} />
          {:else}
            <IconCirclePlus size={16} />
          {/if}
         
        </button>
      </div>
    {/if}
  </div>

  {#if showChildren}
    <div class="d-flex ps-2 gap-2" transition:slide>
      <div class="border-start flex-shrink-0"></div>
      <div class="flex-grow-1 min-w-0">
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
    </div>
  {/if}
</div>
