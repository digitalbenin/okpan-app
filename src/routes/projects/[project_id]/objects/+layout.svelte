<script>
  import { setContext } from "svelte";

  let selectedProjectObjectIds = [];

  function setSelectedProjectObjects(ids) {
    selectedProjectObjectIds = Array.isArray(ids) ? ids : [];
  }

  function getSelectedProjectObjects() {
    return selectedProjectObjectIds;
  }

  setContext("projectObjectsSelection", {
    setSelected: setSelectedProjectObjects,
    getSelected: getSelectedProjectObjects,
  });
</script>

<slot />