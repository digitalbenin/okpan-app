<script>
  import "../assets/main.scss";
  import "bootstrap-icons/font/bootstrap-icons.css";
  import BaseToast from "$lib/components/base/BaseToast.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { onMount } from "svelte";
  import { invalidateAll } from "$app/navigation";

  let { children } = $props();

  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.state;

  let usernameDialogOpen = $state(false);
  let usernameDraft = $state("");
  let isResolvingUsername = $state(false);
  let usernamePromptReady = $state(false);

  async function resolveUsername(value = "") {
    if (isResolvingUsername) {
      return;
    }

    isResolvingUsername = true;

    try {
      await userPresenceStore.saveUsername(value);
      usernameDialogOpen = false;
    } finally {
      isResolvingUsername = false;
    }
  }

  onMount(() => {
    void userPresenceStore.initialize().then(() => {
      usernameDraft = userPresenceState.username || "";
      usernameDialogOpen = !userPresenceState.username;
      usernamePromptReady = true;
    });

    if (window.api && window.api.onDataChanged) {
      const removeListener = window.api.onDataChanged(() => {
        console.log("Data changed from backend, invalidating all...");
        invalidateAll();
      });
      return removeListener;
    }
  });

  $effect(() => {
    if (!usernamePromptReady || !userPresenceState.isInitialized) {
      return;
    }

    if (userPresenceState.username) {
      usernameDraft = userPresenceState.username;
      usernameDialogOpen = false;
      return;
    }

    if (!usernameDialogOpen && !userPresenceState.isSaving && !isResolvingUsername) {
      void resolveUsername("");
    }
  });
</script>

{@render children()}
<BaseToast />

{#if usernameDialogOpen}
  <BaseAlertDialog bind:open={usernameDialogOpen}>
    {#snippet title()}
      Choose your name
    {/snippet}
    {#snippet description()}
      <p class="mb-2">
        This name is global for the app and will be shown to other connected users.
      </p>
      <p class="text-muted small mb-3">
        Leave it empty if you want the app to choose a random name for you.
      </p>
      <BaseInput
        bind:value={usernameDraft}
        placeholder="Enter a username"
        disabled={userPresenceState.isSaving || isResolvingUsername}
      />
    {/snippet}
    {#snippet footer()}
      <BaseButton
        text="Use random name"
        class="btn btn-outline-secondary"
        disabled={userPresenceState.isSaving || isResolvingUsername}
        onClick={() => resolveUsername("")}
      />
      <BaseButton
        text="Continue"
        class="btn btn-primary"
        loading={userPresenceState.isSaving || isResolvingUsername}
        onClick={() => resolveUsername(usernameDraft)}
      />
    {/snippet}
  </BaseAlertDialog>
{/if}
