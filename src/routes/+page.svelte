<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";
  import ProjectImport from "$lib/components/projects/ProjectImport.svelte";
  import ProjectSync from "$lib/components/projects/ProjectSync.svelte";
  import { goto, invalidate, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { getProjects } from "$lib/stores/ProjectsUtils.js";

  const { data } = $props();
  const { t } = getTranslationStore();

  let newProjectOpen = $state(false);
  let importProjectOpen = $state(false);
  let syncProjectOpen = $state(false);
  let projects = $state(data.projects || []);

  $effect(() => {
    projects = data.projects || [];
  });

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

  async function handleSynced({ projectId }) {
    const timeoutAt = Date.now() + 15000;

    while (Date.now() < timeoutAt) {
      await invalidate("app:projects");
      const refreshedProjects = await getProjects();
      projects = refreshedProjects || [];

      if (projects.some((project) => project.id === projectId)) {
        syncProjectOpen = false;
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

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
      <h5 class="text-muted">Coming soon</h5>
    </div>
  </div>
</div>

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
      <ProjectSync onSynced={handleSynced}></ProjectSync>
    {/snippet}
  </BaseAlertDialog>
{/if}
