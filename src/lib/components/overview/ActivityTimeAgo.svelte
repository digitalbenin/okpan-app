<script>
  import { Tooltip } from "bits-ui";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate, normalizeTimestamp, timeAgo } from "$lib/utils/dates";

  const { timestamp } = $props();
  const { translationState } = getTranslationStore();

  const resolvedLocale = $derived.by(() => {
    const locale = String(translationState.currentLocale || "en").toLowerCase();
    return locale;
  });

  const normalizedTimestamp = $derived.by(() => normalizeTimestamp(timestamp));
  const timeAgoText = $derived.by(() => timeAgo(timestamp, resolvedLocale));
</script>

<Tooltip.Provider delayDuration={250}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <span {...props} class="text-black-50 d-block">
          {timeAgoText}
        </span>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content sideOffset={2}>
        <div class="text-bg-dark p-2 rounded d-flex align-items-center">
          {formatDate(normalizedTimestamp, translationState.currentLocale, true)}
        </div>
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
