<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { formatDate } from "$lib/utils/dates";
  // import ProjectCreate from "$lib/components/projects/ProjectCreate.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { projects = [] } = $props();
  const { t, translationState } = getTranslationStore();

  let search = $state("");

  const filteredProjects = $derived(
    projects.filter(
      (project) =>
        project.title.content.toLowerCase().includes(search.toLowerCase()) ||
        project.description.content.toLowerCase().includes(search.toLowerCase())
    )
  );

  $inspect(projects, "projects");
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
      <button class="btn btn-primary"
        >{t("common.new-project", { fallback: "Create a new project" })}</button
      >
    </div>
  </div>
  <div class="d-flex flex-column">
    {#each filteredProjects as project}
      <div class="d-flex border rounded mb-4 p-3 gap-2">
        <div class="d-flex w-50 gap-2">
          <div
            class="bg-primary-subtle rounded px-3 d-flex align-items-center justify-content-center"
          >
            <i class="bi bi-file-text"></i>
          </div>

          <div class="d-flex flex-column">
            <a href="/projects/{project.id}">
              {project.title.content}
            </a>
            <p class="fs-7 mb-0">
              {t("project.created-on", { fallback: "Created on" })}
              {formatDate(+project.created_at, translationState.currentLocale)}
            </p>
          </div>
        </div>
        <div class="d-flex w-50">
          <div class="col">
            <div class="fs-7">{t("project.items", { fallback: "Items" })}</div>
            <div class="fs-5">{project.objectsCount}</div>
          </div>
          <div class="col">
            <div class="fs-7">
              {t("project.assets", { fallback: "Assets" })}
            </div>
            <div class="fs-5">{project.assetsCount}</div>
          </div>
          <div class="col">
            <div class="fs-7">
              {t("project.collections", { fallback: "Collections" })}
            </div>
            <div class="fs-5">{project.institutionsCount}</div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div
    class="emptyProjectChip w-100 d-flex align-items-center justify-content-center border rounded mb-4 p-3 gap-2"
  >
    {t("project.start", { fallback: "Start creating" })}
    <button class="btn btn-primary"
      >{t("project.new", { fallback: "New project" })}</button
    >
  </div>
{/if}

<style>
  .emptyProjectChip {
    border-style: dashed !important;
  }
</style>
