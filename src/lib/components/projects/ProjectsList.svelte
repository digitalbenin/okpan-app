<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";
  import ProjectChip from "$lib/components/projects//ProjectChip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";

  const { projects = [] } = $props();
  const { t, translationState } = getTranslationStore();

  let search = $state("");
  let newProjectOpen = $state(false);

  const filteredProjects = $derived(
    projects.filter(
      (project) =>
        project.title.content.toLowerCase().includes(search.toLowerCase()) ||
        project.description.content.toLowerCase().includes(search.toLowerCase())
    )
  );

  function openNewProjectModal() {
    newProjectOpen = true;
  }
</script>

{#if projects.length}
  <div class="w-100 d-flex align-items-baseline mb-3">
    <h4>
      {t("common.open-project", { fallback: "Open an existing project" })}
    </h4>
    <div class="d-flex gap-2 ms-auto">
      <BaseInput
        bind:value={search}
        placeholder={t("common.search", { fallback: "Search" })}
      />
      <button class="btn btn-primary" onclick={openNewProjectModal}
        >{t("common.new-project", { fallback: "Create a new project" })}</button
      >
    </div>
  </div>
  <div class="d-flex flex-column">
    {#each filteredProjects as project}
      <ProjectChip {project} />
    {/each}
  </div>
{:else}
  <div
    class="emptyProjectChip w-100 d-flex align-items-center justify-content-center border rounded mb-4 mt-3 p-3 gap-2"
  >
    {t("project.start", { fallback: "Start creating" })}
    <button class="btn btn-primary" onclick={openNewProjectModal}
      >{t("project.new", { fallback: "New project" })}</button
    >
  </div>
{/if}
<BaseAlertDialog bind:open={newProjectOpen} size="lg">
  {#snippet title()}
    {t("project.create-project", { fallback: "Create a new project" })}
  {/snippet}
  {#snippet description()}
    <ProjectCreate></ProjectCreate>
  {/snippet}
</BaseAlertDialog>

<style>
  .emptyProjectChip {
    border-style: dashed !important;
  }
</style>
