<script>
  import "../assets/main.scss";
  import "bootstrap-icons/font/bootstrap-icons.css";
  import BaseToast from "$lib/components/base/BaseToast.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { watch } from "runed";
  import { onMount } from "svelte";
  import { invalidate, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";

  let { children, data } = $props();

  const translationStore = getTranslationStore();
  // Initialize store from layout load data, and re-sync whenever invalidate() triggers a reload
  watch(
      () => [data?.interfaceLanguages, data?.interfaceTranslations],
      ([languages, translations]) => {
          if (languages && translations) {
              translationStore.initialize({
                  languages,
                  translations,
                  locale: data.interfaceLocale
              });
          }
      }
  );

  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.userPresenceState;

  let usernameDialogOpen = $state(false);
  let usernameDraft = $state("");
  let isResolvingUsername = $state(false);

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

  // On initialization: sync UI to the persisted username state.
  watch(
    () => userPresenceState.isInitialized,
    (initialized) => {
      if (!initialized) return;
      usernameDraft = userPresenceState.username || "";
      usernameDialogOpen = !userPresenceState.username;
    }
  );

  // If the username is updated externally (e.g. P2P profile sync), reflect it.
  watch(
    () => userPresenceState.username,
    (username) => {
      if (!userPresenceState.isInitialized || !username) return;
      usernameDraft = username;
      usernameDialogOpen = false;
    }
  );

  // If the dialog is dismissed without choosing a name, auto-generate a random one.
  watch(
    () => usernameDialogOpen,
    (open) => {
      if (open || !userPresenceState.isInitialized || userPresenceState.username) return;
      if (!isResolvingUsername && !userPresenceState.isSaving) {
        void resolveUsername("");
      }
    }
  );

  onMount(() => {
    void userPresenceStore.initialize();

    if (!window.api?.onDataChanged) return;

    return window.api.onDataChanged((payload = {}) => {
      const origin = payload?.origin;
      // Only react to peer and snapshot-restore events — everything else is local.
      if (origin !== "p2p" && origin !== "recovery-snapshot-restore") return;

      const activeProjectId = page?.params?.project_id;
      if (payload?.projectId && activeProjectId && String(payload.projectId) !== String(activeProjectId)) return;

      if (!activeProjectId) {
        invalidate("app:projects");
      } else {
        invalidateAll();
      }
    });
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
