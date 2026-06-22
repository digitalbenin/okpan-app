<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    isOpen = $bindable(),
    presetLabel = "",
    onConfirm = () => {},
    onDecline = () => {},
  } = $props();

  const { t } = getTranslationStore();
</script>

<BaseModal
  bind:isOpen
  size="md"
  dialogStyle="max-width: 460px;"
  contentStyle="border-radius: 8px;"
>
  {#snippet header()}
    {t("import.this-looks-familiar", { fallback: "This looks familiar" })}
  {/snippet}

  {#snippet body()}
    <p class="text-body">
      {t("import.template-detected-description", {
        fallback: "The file you chose looks like an export from {{name}}. Would you like to parse it with this template?",
        name: presetLabel,
      })}
    </p>
  {/snippet}

  {#snippet actions()}
    <button class="btn btn-outline-secondary btn-sm" onclick={onDecline}>
      {t("common.decline", { fallback: "Decline" })}
    </button>
    <button class="btn btn-primary btn-sm" onclick={onConfirm}>
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseModal>
