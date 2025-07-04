<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ProjectsList from "$lib/components/projects/ProjectsList.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col-9">
      <!-- <ProjectCreate /> -->
      <h2>{t("common.projects", { fallback: "Projects" })}</h2>
      <ProjectsList projects={data.projects} />
    </div>
    <div class="col-3 vh-100 border-start">
      <h4>{t("common.resources", { fallback: "Resources and guides" })}</h4>
    </div>
  </div>
</div>

<style>
</style>
