<script>
  import "../assets/main.scss";
  import "bootstrap-icons/font/bootstrap-icons.css";
  import BaseToast from "$lib/components/base/BaseToast.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { watch } from "runed";
  import { onMount } from "svelte";
  import { invalidate, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";

  let { children, data } = $props();

  const translationStore = getTranslationStore();
  const { t, translationState, setLocale } = translationStore;
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
  let interfaceLanguageDraft = $state("en");
  let isResolvingUsername = $state(false);

  async function resolveUsername(value = "") {
    if (isResolvingUsername) {
      return;
    }

    isResolvingUsername = true;

    try {
      await userPresenceStore.saveUsername(value);
      await setLocale(interfaceLanguageDraft);
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
      interfaceLanguageDraft = translationState.currentLocale || translationState.languages[0]?.code || "en";
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
      {t("onboarding.before-starting", { fallback: "Before starting..." })}
    {/snippet}
    {#snippet description()}
      <p class="mb-4">
        {t("settings.application-description", {
          fallback: "Choose your username and the language used for the application interface.",
        })}
      </p>
      <div class="mb-3">
        <label class="form-label mb-2" for="onboarding-username-input">
          {t("common.username", { fallback: "Username" })}
        </label>
        <BaseInput
          id="onboarding-username-input"
          bind:value={usernameDraft}
          placeholder={t("common.username", { fallback: "Username" })}
          disabled={userPresenceState.isSaving || isResolvingUsername}
        />
      </div>
      <div>
        <label class="form-label mb-2" for="onboarding-language-select">
          {t("settings.interface-language", { fallback: "Interface language" })}
        </label>
        <select
          id="onboarding-language-select"
          class="form-select"
          bind:value={interfaceLanguageDraft}
          disabled={translationState.isLoading || translationState.languages.length === 0}
        >
          {#each translationState.languages as language}
            <option value={language.code}>
              {language.name} ({language.code})
            </option>
          {/each}
        </select>
      </div>
    {/snippet}
    {#snippet footer()}
      <button
        class="btn btn-outline-secondary"
        onclick={() => {
          usernameDialogOpen = false;
        }}
        disabled={userPresenceState.isSaving || isResolvingUsername}
      >
        {t("common.cancel", { fallback: "Cancel" })}
      </button>
      <button
        class="btn btn-primary"
        onclick={() => resolveUsername(usernameDraft)}
        disabled={userPresenceState.isSaving || isResolvingUsername}
      >
        {#if userPresenceState.isSaving || isResolvingUsername}
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        {/if}
        {t("common.next", { fallback: "Next" })}
      </button>
    {/snippet}
  </BaseAlertDialog>
{/if}
