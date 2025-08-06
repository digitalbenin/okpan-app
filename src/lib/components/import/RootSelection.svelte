<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { createTreeNode } from "$lib/utils/import.js";
  import JsonViewer from "./JsonViewer.svelte";

  const { jsonData } = $props();
  const { t } = getTranslationStore();

  const wizard = getImportWizardContext();

  function formatValue(value, type) {
    switch (type) {
      case "string":
        return `"${value}"`;
      case "null":
        return "null";
      case "undefined":
        return "undefined";
      case "date":
        return value.toISOString();
      default:
        return String(value);
    }
  }

  let expandedNodes = $state(new Set());

  function toggleNode(pathString) {
    if (expandedNodes.has(pathString)) {
      expandedNodes.delete(pathString);
    } else {
      expandedNodes.add(pathString);
    }
    expandedNodes = new Set(expandedNodes);
  }

  function isExpanded(node) {
    return expandedNodes.has(node.pathString) || node.depth === 0;
  }

  let checkedNode = $state();
  let selectedItems = $state(0);

  function checkNode(node) {
    selectedItems = node.size;
    checkedNode = node.pathString;
    if (selectedItems > 0) {
      wizard.nextEnabled = true; // Enable next step if items are selected
      if (Array.isArray(node.value)) {
        wizard.data = node.value;
      } else if (typeof node.value === "object") {
        const objectArray = Object.entries(node.value).map(([key, value]) => ({
          ...value,
          __key: key,
        }));
        wizard.data = objectArray;
      } else {
        node.value = [node.value];
      }
    } else {
      wizard.nextEnabled = false;
      wizard.data = null;
    }
  }

  function isChecked(node) {
    return checkedNode === node.pathString;
  }

  let tree = $derived(createTreeNode(jsonData, null, 0, []));
</script>

<div class="alert alert-primary sticky-top">
  {t("common.select-items", {
    fallback: "Select where the objects are stored in the tree structure",
  })}.
  <span class="fw-bold"
    >{t("common.selected-items", { fallback: "Selected objects" })}:
    {selectedItems}</span
  >.
</div>
{#if tree}
  <JsonViewer
    node={tree}
    {formatValue}
    {isExpanded}
    {toggleNode}
    {isChecked}
    {checkNode}
    maxDepth={10}
  />
{/if}
