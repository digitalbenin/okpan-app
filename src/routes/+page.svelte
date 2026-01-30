<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";
  import ProjectImport from "$lib/components/projects/ProjectImport.svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/stores";

  const { data } = $props();
  const { t } = getTranslationStore();

  let newProjectOpen = $state(false);
  let importProjectOpen = $state(false);

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
