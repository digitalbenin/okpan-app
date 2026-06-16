<script>
  import ProjectChip from "$lib/components/projects//ProjectChip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { projects = [] } = $props(); 
  const { t } = getTranslationStore();
</script>

<div class="d-flex flex-column gap-2 w-100">
{#if projects.length === 0}
    <div class="d-flex align-items-center justify-content-center border border-secondary-subtle rounded-4 p-5 m-0 fs-7 text-body-secondary">
      {t("projects.no-projects-found", { fallback: "No projects found" })}
    </div>
  {/if}

  {#each projects as project}
    <ProjectChip {project} />
  {/each}
</div>
