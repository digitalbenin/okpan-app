<script>
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    isOpen = $bindable(false),
    isDeleting = false,
    onCancel = () => {},
    onConfirm = () => {},
  } = $props();

  const { t } = getTranslationStore();
</script>

{#snippet header()}
  {t("common.confirm-delete", { fallback: "Confirm Deletion" })}
{/snippet}

{#snippet body()}
  <p>
    {t("common.confirm-delete-object", {
      fallback: "Are you sure you want to delete this object? This action cannot be undone.",
    })}
  </p>
{/snippet}

{#snippet actions()}
  <div class="d-flex justify-content-end gap-2">
    <BaseButton
      type="button"
      class="btn btn-secondary btn-sm"
      text={t("common.cancel", { fallback: "cancel" })}
      onClick={onCancel}
      disabled={isDeleting}
    />
    <BaseButton
      type="button"
      class="btn btn-danger btn-sm"
      text={isDeleting
        ? t("common.deleting", { fallback: "Deleting..." })
        : t("common.confirm-and-delete", { fallback: "Confirm and delete" })}
      onClick={onConfirm}
      disabled={isDeleting}
    />
  </div>
{/snippet}

<BaseModal bind:isOpen={isOpen} size="md" {header} {body} {actions} />
