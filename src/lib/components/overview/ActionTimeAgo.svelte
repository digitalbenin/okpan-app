<script>
  import { Tooltip } from "bits-ui";
  import dayjs from "dayjs";
  import relativeTime from "dayjs/plugin/relativeTime";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";

  const { timestamp } = $props();
  const { t, translationState } = getTranslationStore();
  dayjs.extend(relativeTime);

  let timeAgo = $state(dayjs(timestamp).fromNow()); // "2 hours ago"

  // Dynamically load locale
  async function loadLocale(locale) {
    try {
      await import(/* @vite-ignore */ `dayjs/locale/${locale}.js`);
      dayjs.locale(locale);
      timeAgo = dayjs(timestamp).fromNow();
    } catch (error) {
      console.warn(`Locale ${locale} not found, falling back to English`);
      dayjs.locale("en");
      timeAgo = dayjs(timestamp).fromNow();
    }
  }

  $effect(() => {
    loadLocale(translationState.currentLocale);
  });
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
