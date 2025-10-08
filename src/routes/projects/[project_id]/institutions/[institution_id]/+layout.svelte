<script>
  import { setContext } from "svelte";

  let { children } = $props();

  // Selection lives locally; expose setter and a getter for current values
  let selectedIds = $state([]);
  function setSelected(ids) {
    selectedIds = (ids || []).map((s) => String(s));
  }
  function getSelected() {
    return selectedIds;
  }

  // Provide reactive-style API via functions to avoid stale snapshots
  setContext("institutionAssetsSelection", { getSelected, setSelected });

  // Separate selection context for objects (bulk edit)
  let selectedObjectIds = $state([]);
  function setSelectedObjects(ids) {
    selectedObjectIds = (ids || []).map((s) => String(s));
  }
  function getSelectedObjects() {
    return selectedObjectIds;
  }
  setContext("institutionObjectsSelection", {
    getSelected: getSelectedObjects,
    setSelected: setSelectedObjects,
  });
</script>

{@render children()}