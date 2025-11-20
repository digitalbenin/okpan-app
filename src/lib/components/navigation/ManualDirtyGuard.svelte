<script>
  import { watch } from "runed";
  import { createDirtyTracker } from "$lib/stores/DirtyTracker.svelte.js";
  import DirtyNavigationGuard from "$lib/components/navigation/DirtyNavigationGuard.svelte";

  let {
    values = null,
    enabled = true,
    message = null,
    pristineKey = 0,
  } = $props();

  const tracker = createDirtyTracker({ initialData: values });

  watch(
    () => values,
    (nextValues) => {
      tracker.update(nextValues ?? null);
    }
  );

  watch(
    () => pristineKey,
    () => {
      tracker.setPristine(values ?? null);
    }
  );
</script>

<DirtyNavigationGuard
  dirtyTracker={tracker}
  enabled={enabled}
  message={message}
/>
