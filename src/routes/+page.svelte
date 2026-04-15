<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";
  import ProjectImport from "$lib/components/projects/ProjectImport.svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";

  const { data } = $props();
  const { t, translationState, setLocale } = getTranslationStore();

  let newProjectOpen = $state(false);
  let importProjectOpen = $state(false);
  let appSettingsOpen = $state(false);
  let interfaceLanguageDraft = $state("en");
  let isSavingAppSettings = $state(false);
  let appSettingsError = $state("");

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
      interfaceLanguageDraft =
        translationState.currentLocale || translationState.languages[0]?.code || "en";
      appSettingsError = "";
    }
  });

  const dropdownItems = [
    {
      label: t("project.new", { fallback: "New project" }),
      icon: "plus-circle",
      onClick: () => {
        setTimeout(() => {
          newProjectOpen = true;
        }, 100);
      }
    },
    {
      label: t("project.import-from-file", { fallback: "Import from file" }),
      icon: "file-earmark-arrow-up",
      onClick: () => {
        setTimeout(() => {
          importProjectOpen = true;
        }, 100);
      }
    }
  ];

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

  function handleNewProject() {
    setTimeout(() => {
      newProjectOpen = true;
    }, 100);
  }

  async function handleSaveAppSettings() {
    isSavingAppSettings = true;
    appSettingsError = "";

    try {
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
        projects={data.projects} 
        onNewProject={handleNewProject}
        {dropdownItems}
      />
    </div>
    <div class="col-3 vh-100 border-start">
      <h4>{t("common.resources", { fallback: "Resources and guides" })}</h4>
      <h5 class="text-muted">Coming soon</h5>
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
          fallback: "Choose the language used for the application interface.",
        })}
      </p>
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
