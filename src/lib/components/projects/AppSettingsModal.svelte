<script>
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { watch } from "runed";

  let {
    open = $bindable(false),
    onSave
  } = $props();

  const { t, translationState } = getTranslationStore();
  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.userPresenceState;

  let usernameDraft = $state("");
  let interfaceLanguageDraft = $state("en");
  let isSaving = $state(false);
  let error = $state("");

  watch(
    () => open,
    (isOpen) => {
      if (!isOpen) return;
      void userPresenceStore.initialize();
      usernameDraft = userPresenceState.username || "";
      interfaceLanguageDraft =
        translationState.currentLocale || translationState.languages[0]?.code || "en";
      error = "";
    }
  );

  async function handleSave() {
    isSaving = true;
    error = "";

    try {
      await onSave({ username: usernameDraft, locale: interfaceLanguageDraft });
      open = false;
    } catch (err) {
      error = err.message || t("settings.application-save-error", {
        fallback: "Unable to save application settings.",
      });
    } finally {
      isSaving = false;
    }
  }
</script>

<BaseAlertDialog bind:open>
  {#snippet title()}
    {t("settings.application", { fallback: "Application settings" })}
  {/snippet}
  {#snippet description()}
    <p class="text-muted mb-3">
      {t("settings.application-description", {
        fallback: "Choose your username and the language used for the application interface.",
      })}
    </p>
    <div class="mb-3">
      <label class="form-label" for="app-settings-username">
        {t("common.username", { fallback: "Username" })}
      </label>
      <!--<p class="text-muted small mb-2">
        {t("settings.username-description", {
          fallback: "Leave it empty if you want the app to choose a random name for you.",
    })} 
      </p> -->
      <BaseInput
        id="app-settings-username"
        bind:value={usernameDraft}
        placeholder={t("common.username", { fallback: "Username" })}
        disabled={isSaving}
      />
    </div>
    <div class="mb-3">
      <label class="form-label" for="app-settings-language">
        {t("settings.interface-language", { fallback: "Interface language" })}
      </label>
      <select
        id="app-settings-language"
        class="form-select"
        bind:value={interfaceLanguageDraft}
        disabled={translationState.isLoading || translationState.languages.length === 0}
      >
        {#each translationState.languages as language}
          <option value={language.code}>
            {language.name}
          </option>
        {/each}
      </select>
    </div>

    {#if error}
      <div class="alert alert-danger py-2 mb-0">{error}</div>
    {/if}
  {/snippet}
  {#snippet footer()}
    <button
      class="btn btn-secondary"
      onclick={() => { open = false; }}
      disabled={isSaving}
    >
      {t("common.cancel", { fallback: "Cancel" })}
    </button>
    <button
      class="btn btn-primary"
      onclick={handleSave}
      disabled={isSaving || !interfaceLanguageDraft}
    >
      {#if isSaving}
        <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      {/if}
      {t("common.save", { fallback: "Save" })}
    </button>
  {/snippet}
</BaseAlertDialog>
