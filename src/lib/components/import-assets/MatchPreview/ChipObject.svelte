<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { object, mappedObject = $bindable() } = $props();
  const { t } = getTranslationStore();
</script>

<div class="rounded bg-secondary-subtle p-2">
  <div>info</div>
  <div>meta</div>
  <div>other media</div>
</div>
