<script>
  import { beforeNavigate, goto } from "$app/navigation";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let {
    dirtyTracker = null,
    enabled = true,
    title = null,
    message = null,
    confirmText = null,
    cancelText = null,
  } = $props();

  const { t } = getTranslationStore();

  let showDialog = $state(false);
  let pendingNavigation = $state(null);
  let bypassNextNavigation = $state(false);

  // Watch for dirty state changes
  const isDirty = $derived(dirtyTracker?.isDirty ?? false);
  const resolvedTitle = $derived(
    title ?? t("navigation.unsaved-changes-title")
  );
  const resolvedMessage = $derived(
    message ?? t("form.unsaved-changes")
  );
  const resolvedConfirmText = $derived(
    confirmText ?? t("common.leave-without-saving")
  );
  const resolvedCancelText = $derived(
    cancelText ?? t("common.stay-on-page")
  );

  // Intercept navigation when dirty
  beforeNavigate((navigation) => {
    if (bypassNextNavigation) {
      bypassNextNavigation = false;
      return;
    }

    if (!enabled || !isDirty) return;

    // Cancel navigation and show dialog
    navigation.cancel();
    pendingNavigation = navigation;
    showDialog = true;
  });

  function handleStay() {
    showDialog = false;
    pendingNavigation = null;
  }

  function handleLeave() {
    const navigation = pendingNavigation;
    showDialog = false;
    pendingNavigation = null;

    const targetUrl = navigation?.to?.url;
    if (!targetUrl) return;

    bypassNextNavigation = true;
    goto(targetUrl);
  }
</script>

<BaseModal bind:isOpen={showDialog} size="md">
  {#snippet header()}{resolvedTitle}{/snippet}
  {#snippet body()}
    <p class="mb-0">{resolvedMessage}</p>
  {/snippet}
  {#snippet actions()}
    <button type="button" class="btn btn-outline-secondary" onclick={handleStay}>
        {resolvedCancelText}
    </button>
    <button type="button" class="btn btn-danger" onclick={handleLeave}>
        {resolvedConfirmText}
    </button>
  {/snippet}
</BaseModal>
