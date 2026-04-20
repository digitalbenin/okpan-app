<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import ProjectChip from "$lib/components/projects//ProjectChip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { 
    projects = [], 
    onNewProject = () => {},
    dropdownItems = []
  } = $props();
  const { t } = getTranslationStore();

  let search = $state("");

  const filteredProjects = $derived(
    projects.filter(
      (project) =>
        project.title.content.toLowerCase().includes(search.toLowerCase()) ||
        project.description.content
          .toLowerCase()
          .includes(search.toLowerCase()),
    ),
  );
</script>

{#if projects.length}
  <div class="w-100 d-flex align-items-baseline mb-3">
    <h4>
      {t("common.open-project")}
    </h4>
    <div class="d-flex gap-2 ms-auto align-items-center">
      <BaseInput
        bind:value={search}
        placeholder={t("common.search")}
      />
      <BaseDropdownMenu
        items={dropdownItems}
        triggerClass="btn btn-primary flex-shrink-0"
      >
        {#snippet trigger()}
          {t("common.new-project")}
          <i class="bi bi-chevron-down ms-1"></i>
        {/snippet}
      </BaseDropdownMenu>
    </div>
  </div>
  <div class="d-flex flex-column">
    {#each filteredProjects as project}
      <ProjectChip {project} />
    {/each}
  </div>
{:else}
  <div
    class="w-100 d-flex align-items-center justify-content-center rounded mb-4 mt-3 p-3 gap-2"
  >
    {t("project.start")}
    <BaseDropdownMenu
      items={dropdownItems}
      triggerClass="btn btn-primary"
    >
      {#snippet trigger()}
        {t("project.new")}
        <i class="bi bi-chevron-down ms-1"></i>
      {/snippet}
    </BaseDropdownMenu>
  </div>
{/if}
