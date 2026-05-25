<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";
  import ProjectImport from "$lib/components/projects/ProjectImport.svelte";
  import ProjectSync from "$lib/components/projects/ProjectSync.svelte";
  import { goto, invalidate, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { watch } from "runed";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { getProjects } from "$lib/api/ProjectsApi.js";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { onMount } from "svelte";

  const { data } = $props();
  const { t, translationState, setLocale } = getTranslationStore();
  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.state;

  let newProjectOpen = $state(false);
  let importProjectOpen = $state(false);
  let syncProjectOpen = $state(false);
  let projects = $state([]);
  let appSettingsOpen = $state(false);
  let usernameDraft = $state("");
  let interfaceLanguageDraft = $state("en");
  let isSavingAppSettings = $state(false);
  let appSettingsError = $state("");

  watch(
    () => data.projects,
    (nextProjects) => {
      projects = nextProjects || [];
    }
  );

  // Watch for URL parameters to trigger modals
  $effect(() => {
    const createParam = $page.url.searchParams.get('create');
    if (createParam === 'new') {
      setTimeout(() => {
        newProjectOpen = true;
        // Remove the parameter from URL without navigation
        const url = new URL(window.location.href);
        url.searchParams.delete('create');
        window.history.replaceState({}, '', url);
      }, 100);
    }
  });

  $effect(() => {
    if (appSettingsOpen) {
      void userPresenceStore.initialize();
      usernameDraft = userPresenceState.username || "";
      interfaceLanguageDraft =
        translationState.currentLocale || translationState.languages[0]?.code || "en";
      appSettingsError = "";
    }
  });

  onMount(() => {
    if (!window.api?.onDataChanged) {
      return;
    }

    const unsubscribe = window.api.onDataChanged((payload = {}) => {
      const origin = payload?.origin;

      if (origin !== "p2p" && origin !== "recovery-snapshot-restore") {
        return;
      }

      void invalidate("app:projects");
    });

    return unsubscribe;
  });

  const dropdownItems = $derived([
    {
      label: t("project.new"),
      icon: "plus-circle",
      onClick: () => {
        setTimeout(() => {
          newProjectOpen = true;
        }, 100);
      }
    },
    {
      label: t("project.import-from-file"),
      icon: "file-earmark-arrow-up",
      onClick: () => {
        setTimeout(() => {
          importProjectOpen = true;
        }, 100);
      }
    },
    {
      label: t("project.sync-project", { fallback: "Sync project" }),
      icon: "cloud-arrow-down",
      onClick: () => {
        setTimeout(() => {
          syncProjectOpen = true;
        }, 100);
      }
    }
  ]);

  async function handleCreated({ projectId }) {
    newProjectOpen = false;
    if (!projectId) {
      console.warn('[Projects] Missing projectId in handleCreated');
      return;
    }
    const path = `/projects/${projectId}`;
    try {
      await goto(path);
    } catch (err) {
      console.error('[Projects] Navigation failed', err);
    }
  }

  async function handleImported({ projectId, metadata }) {
    importProjectOpen = false;

    // Invalidate all data to refresh the projects list
    await invalidateAll();

    if (!projectId) {
      console.warn('[Projects] Missing projectId in handleImported');
      return;
    }

    // Navigate to the imported project
    const path = `/projects/${projectId}`;
    try {
      await goto(path);
    } catch (err) {
      console.error('[Projects] Navigation failed', err);
    }
  }

  async function handleSynced({ projectId }) {
    const timeoutAt = Date.now() + 40000;

    while (Date.now() < timeoutAt) {
      await invalidate("app:projects");
      projects = (await getProjects()) || [];

      if (projects.some((project) => project.id === projectId)) {
        syncProjectOpen = false;
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    syncProjectOpen = false;

    addToast({
      data: {
        title: "Project sync",
        description: "Project found on the network, but it is still initializing locally.",
        type: "warning",
      },
    });

    return false;
  }

  function handleNewProject() {
    setTimeout(() => {
      newProjectOpen = true;
    }, 100);
  }

  async function handleSaveAppSettings() {
    isSavingAppSettings = true;
    appSettingsError = "";

    try {
      const normalizedUsernameDraft = usernameDraft.trim();
      const normalizedCurrentUsername = (userPresenceState.username || "").trim();

      if (normalizedUsernameDraft !== normalizedCurrentUsername) {
        await userPresenceStore.saveUsername(usernameDraft);
        usernameDraft = userPresenceState.username || "";
      }

      const saved = await setLocale(interfaceLanguageDraft);
      if (!saved) {
        appSettingsError = t("settings.interface-language-invalid", {
          fallback: "The selected interface language is not available.",
        });
        return;
      }

      appSettingsOpen = false;
    } catch (error) {
      console.error("[App Settings] Failed to save interface language", error);
      appSettingsError = t("settings.application-save-error", {
        fallback: "Unable to save application settings.",
      });
    } finally {
      isSavingAppSettings = false;
    }
  }
</script>

<div class="container-fluid">
  <div class="row p-3">
    <div class="col-9">
      <h2>{t("common.projects", { fallback: "Projects" })}</h2>
      
      <ProjectsList 
        {projects}
        onNewProject={handleNewProject}
        {dropdownItems}
      />
    </div>
    <div class="col-3 vh-100 border-start">
      <h4>{t("common.resources", { fallback: "Resources and guides" })}</h4>
      <h5 class="text-muted">{t("common.coming-soon", { fallback: "Coming soon" })}</h5>
    </div>
  </div>
</div>

<button
  class="btn btn-outline-secondary position-fixed bottom-0 start-0 m-4 d-flex align-items-center gap-2 shadow-sm"
  style="z-index: 10;"
  onclick={() => {
    appSettingsOpen = true;
  }}
>
  <i class="bi bi-sliders"></i>
  {t("settings.application", { fallback: "Application settings" })}
</button>

{#if newProjectOpen}
  <BaseAlertDialog bind:open={newProjectOpen} size="lg">
    {#snippet title()}
      {t("project.create-project", { fallback: "Create a new project" })}
    {/snippet}
    {#snippet description()}
      <ProjectCreate onCreated={handleCreated}></ProjectCreate>
    {/snippet}
  </BaseAlertDialog>
{/if}

{#if appSettingsOpen}
  <BaseAlertDialog bind:open={appSettingsOpen}>
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
        <label class="form-label" for="application-username-input">
          {t("common.username", { fallback: "Username" })}
        </label>
        <p class="text-muted small mb-2">
          {t("settings.username-description", {
            fallback: "Leave it empty if you want the app to choose a random name for you.",
          })}
        </p>
        <BaseInput
          id="application-username-input"
          bind:value={usernameDraft}
          placeholder={t("common.username", { fallback: "Username" })}
          disabled={isSavingAppSettings}
        />
      </div>
      <div class="mb-3">
        <label class="form-label" for="interface-language-select">
          {t("settings.interface-language", {
            fallback: "Interface language",
          })}
        </label>
        <select
          id="interface-language-select"
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

      {#if appSettingsError}
        <div class="alert alert-danger py-2 mb-0">{appSettingsError}</div>
      {/if}
    {/snippet}
    {#snippet footer()}
      <button
        class="btn btn-secondary"
        onclick={() => {
          appSettingsOpen = false;
        }}
        disabled={isSavingAppSettings}
      >
        {t("common.cancel", { fallback: "Cancel" })}
      </button>
      <button
        class="btn btn-primary"
        onclick={handleSaveAppSettings}
        disabled={isSavingAppSettings || !interfaceLanguageDraft}
      >
        {#if isSavingAppSettings}
          <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
        {/if}
        {t("common.save", { fallback: "Save" })}
      </button>
    {/snippet}
  </BaseAlertDialog>
{/if}

{#if importProjectOpen}
  <BaseAlertDialog bind:open={importProjectOpen} size="lg">
    {#snippet title()}
      {t("project.import-from-file", { fallback: "Import from file" })}
    {/snippet}
    {#snippet description()}
      <ProjectImport onImported={handleImported}></ProjectImport>
    {/snippet}
  </BaseAlertDialog>
{/if}

{#if syncProjectOpen}
  <BaseAlertDialog bind:open={syncProjectOpen} size="lg">
    {#snippet title()}
      {t("project.sync-project", { fallback: "Sync project" })}
    {/snippet}
    {#snippet description()}
      <ProjectSync
        onSynced={handleSynced}
        onTimeout={() => {
          syncProjectOpen = false;
        }}
      ></ProjectSync>
    {/snippet}
  </BaseAlertDialog>
{/if}
