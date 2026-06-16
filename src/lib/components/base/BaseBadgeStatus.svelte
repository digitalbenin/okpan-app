<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();
  const { status, showChevron = false, className = "" } = $props();

  const label = $derived(
    status === "completed"
      ? t("common.completed", { fallback: "Completed" })
      : t("common.in-progress", { fallback: "Draft" })
  );
</script>

<span
  class={`badge rounded-3 fw-normal border py-1 px-1 lh-1 align-self-start fs-8 ${className}`}
  class:bg-success-subtle={status === "completed"}
  class:border-success-subtle={status === "completed"}
  class:text-success-emphasis={status === "completed"}
  class:bg-warning-subtle={status === "in progress"}
  class:border-warning-subtle={status === "in progress"}
  class:text-warning-emphasis={status === "in progress"}
>
  {label}
  {#if showChevron}
    <i class="bi bi-chevron-down ms-1"></i>
  {/if}
</span>
