<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";
  import AppHeader from "$lib/components/projects/AppHeader.svelte";
  import StartFromHere from "$lib/components/projects/StartFromHere.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import AppSettingsModal from "$lib/components/projects/AppSettingsModal.svelte";
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
  import { IconSearch } from "@tabler/icons-svelte";

  const { data } = $props();
  const { t, setLocale } = getTranslationStore();
  const userPresenceStore = getUserPresenceStore();

  let newProjectOpen = $state(false);
  let importProjectOpen = $state(false);
  let syncProjectOpen = $state(false);
  let projects = $state([]);
  let search = $state("");
  let appSettingsOpen = $state(false);

  const filteredProjects = $derived(
    projects.filter(
      (project) => {
        const titleContent = project.title?.content || "Connecting/Unknown Project";
        const descriptionContent = project.description?.content || "";
        return titleContent.toLowerCase().includes(search.toLowerCase()) ||
               descriptionContent.toLowerCase().includes(search.toLowerCase());
      }
    ),
  );

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

  async function handleSaveAppSettings({ username, locale }) {
    const normalizedDraft = username.trim();
    const normalizedCurrent = (userPresenceStore.userPresenceState.username || "").trim();

    if (normalizedDraft !== normalizedCurrent) {
      await userPresenceStore.saveUsername(username);
    }

    const saved = await setLocale(locale);
    if (!saved) {
      throw new Error(t("settings.interface-language-invalid", {
        fallback: "The selected interface language is not available.",
      }));
    }
  }
</script>

{#if projects.length === 0}
  <div class="min-vh-100" style="background-color: #f5f5f3;">
    <AppHeader onSettingsClick={() => { appSettingsOpen = true; }} />

    <div class="p-4 d-flex flex-column gap-5">
      <div>
        <p class="text-uppercase mb-3" style="font-size: 12px; letter-spacing: 0.24px; color: #292927;">
          {t("onboarding.start-from-here", { fallback: "Start from here" })}
        </p>
        <StartFromHere
          variant="cards"
          onCreateProject={handleNewProject}
          onImportProject={() => { importProjectOpen = true; }}
          onJoinProject={() => { syncProjectOpen = true; }}
        />
      </div>

      <div>
        <p class="text-uppercase mb-3" style="font-size: 12px; letter-spacing: 0.24px; color: #292927;">
          {t("onboarding.your-projects", { fallback: "Your projects" })}
        </p>
        <div
          class="border border-dashed d-flex align-items-center justify-content-center w-100"
          style="border-color: #d5d6d0; border-radius: 16px; min-height: 120px;"
        >
          <p class="m-0" style="font-size: 14px; color: rgba(29,34,38,0.75);">
            {t("onboarding.no-projects-yet", { fallback: "No projects yet" })}
          </p>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="min-vh-100" style="background-color: #f5f5f3;">
    <AppHeader onSettingsClick={() => { appSettingsOpen = true; }} />

    <div class="p-4 d-flex gap-4">
      <div class="d-flex flex-column gap-3" style="width: 334px; flex-shrink: 0;">
        <p class="text-uppercase m-0" style="font-size: 12px; letter-spacing: 0.24px; color: #292927;">
          {t("onboarding.start-from-here", { fallback: "Start from here" })}
        </p>
        <StartFromHere
          variant="list"
          onCreateProject={handleNewProject}
          onImportProject={() => { importProjectOpen = true; }}
          onJoinProject={() => { syncProjectOpen = true; }}
        />
      </div>

      <div class="d-flex flex-column gap-3 flex-fill">
        <div class="d-flex align-items-center justify-content-between">
          <p class="text-uppercase m-0" style="font-size: 12px; letter-spacing: 0.24px; color: #292927;">
            {t("onboarding.your-projects", { fallback: "Your projects" })}
          </p>
          <div class="d-flex align-items-center border" style="border-color: #d5d6d0; border-radius: 6.4px; width: 300px;">
            <input
              type="text"
              class="form-control border-0 flex-fill"
              placeholder={t("common.search", { fallback: "Search" })}
              bind:value={search}
              style="font-size: 16px; padding: 4px 16px; border-radius: 6.4px 0 0 6.4px;"
            />
            <button class="btn bg-white border-0 p-2" style="border-radius: 0 6.4px 6.4px 0;">
              <IconSearch size={16} stroke={2} />
            </button>
          </div>
        </div>
        <ProjectsList projects={filteredProjects} />
      </div>
    </div>
  </div>
{/if}

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

<AppSettingsModal bind:open={appSettingsOpen} onSave={handleSaveAppSettings} />

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
