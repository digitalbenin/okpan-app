<script>
  import { Tooltip } from "bits-ui";
  import dayjs from "dayjs";
  import "dayjs/locale/en";
  import "dayjs/locale/it";
  import relativeTime from "dayjs/plugin/relativeTime";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";

  const { timestamp } = $props();
  const { translationState } = getTranslationStore();
  dayjs.extend(relativeTime);

  const resolvedLocale = $derived.by(() => {
    const locale = String(translationState.currentLocale || "en").toLowerCase();
    return locale;
  });

  const timeAgo = $derived.by(() => dayjs(timestamp).locale(resolvedLocale).fromNow());
</script>

<Tooltip.Provider delayDuration={250}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <span {...props} class="text-black-50 d-block">
          {timeAgo}
        </span>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content sideOffset={2}>
        <div class="text-bg-dark p-2 rounded d-flex align-items-center">
          {formatDate(timestamp, translationState.currentLocale, true)}
        </div>
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
