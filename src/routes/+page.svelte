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
  watch(
    () => $page.url.searchParams.get('create'),
    (createParam) => {
      if (createParam === 'new') {
        setTimeout(() => {
          newProjectOpen = true;
          const url = new URL(window.location.href);
          url.searchParams.delete('create');
          window.history.replaceState({}, '', url);
        }, 100);
      }
    }
  );

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
    await invalidateAll();

    if (!projectId) {
      console.warn('[Projects] Missing projectId in handleImported');
      return;
    }
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

<div class="min-vh-100 bg-gray-200">
  <AppHeader onSettingsClick={() => { appSettingsOpen = true; }} />

  {#if projects.length === 0}
    <div class="p-4 d-flex flex-column gap-5">
      <div>
        <p class="fs-8 text-uppercase mb-3 text-body" style="letter-spacing: 0.24px;">
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
        <p class="fs-8 text-uppercase mb-3 text-body" style="letter-spacing: 0.24px;">
          {t("onboarding.your-projects", { fallback: "Your projects" })}
        </p>
        <div class="border border-gray-500 border-dashed rounded-4 d-flex align-items-center justify-content-center w-100" style="min-height: 120px;">
          <p class="m-0 fs-7 text-body-secondary">
            {t("onboarding.no-projects-yet", { fallback: "No projects yet" })}
          </p>
        </div>
      </div>
    </div>
  {:else}
    <div class="p-4 d-flex gap-4">
      <!-- Sidebar -->
      <div class="d-flex flex-column gap-3 flex-shrink-0" style="width: 334px;">
        <p class="fs-8 text-uppercase m-0 text-body" style="letter-spacing: 0.24px;">
          {t("onboarding.start-from-here", { fallback: "Start from here" })}
        </p>
        <StartFromHere
          variant="list"
          onCreateProject={handleNewProject}
          onImportProject={() => { importProjectOpen = true; }}
          onJoinProject={() => { syncProjectOpen = true; }}
        />
      </div>

      <!-- Projects list -->
      <div class="d-flex flex-column gap-3 flex-fill">
        <!-- Header row -->
        <div class="d-flex align-items-center justify-content-between">
          <p class="fs-8 text-uppercase m-0 text-body" style="letter-spacing: 0.24px;">
            {t("onboarding.your-projects", { fallback: "Your projects" })}
          </p>

          <!-- Search -->
          <div class="d-flex align-items-center border border-gray-500 rounded-sm overflow-hidden" style="width: 300px;">
            <input
              type="text"
              class="form-control border-0 flex-fill"
              placeholder={t("common.search", { fallback: "Search" })}
              bind:value={search}
              style="padding: 4px 16px;"
            />
            <span class="bg-white d-flex align-items-center justify-content-center flex-shrink-0" style="padding: 12px;">
              <IconSearch size={16} stroke={2} />
            </span>
          </div>
        </div>

        <ProjectsList projects={filteredProjects} />
      </div>
    </div>
  {/if}
</div>

{#if newProjectOpen}
  <BaseAlertDialog bind:open={newProjectOpen}>
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
