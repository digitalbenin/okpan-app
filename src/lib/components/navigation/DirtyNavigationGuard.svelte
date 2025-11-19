<script>
  import { beforeNavigate, goto } from "$app/navigation";
  import BaseModal from "$lib/components/base/BaseModal.svelte";

  let {
    dirtyTracker = null,
    enabled = true,
    title = "Unsaved changes",
    message = "You have unsaved changes. Are you sure you want to leave without saving?",
    confirmText = "Leave without saving",
    cancelText = "Stay on page",
  } = $props();

  let showDialog = $state(false);
  let pendingNavigation = $state(null);
  let bypassNextNavigation = $state(false);

  // Watch for dirty state changes
  const isDirty = $derived(dirtyTracker?.isDirty ?? false);

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
  {#snippet header()}{title}{/snippet}
  {#snippet body()}
    <p class="mb-0">{message}</p>
  {/snippet}
  {#snippet actions()}
    <button type="button" class="btn btn-outline-secondary" onclick={handleStay}>
        {cancelText}
    </button>
    <button type="button" class="btn btn-danger" onclick={handleLeave}>
        {confirmText}
    </button>
  {/snippet}
</BaseModal>
