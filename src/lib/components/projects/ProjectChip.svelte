<script>
  import { formatDate } from "$lib/utils/dates";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { deleteProject } from "$lib/stores/ProjectsUtils.js";

  const { project } = $props();
  const { t, translationState } = getTranslationStore();

  let dropdownOpen = $state(false);
  let showDeleteModal = $state(false);
  let confirmationText = $state("");

  const dropdownItems = $derived([
    {
      label: t("common.delete", { fallback: "Delete" }),
      icon: "trash",
      onClick: () => {
        showDeleteModal = true;
        confirmationText = "";
      },
    },
  ]);

  const isDeleteEnabled = $derived(
    confirmationText.trim() === (project.title?.content || "Connecting...").trim()
  );

  const isSharedProject = $derived(project?.is_shared === 1 || project?.is_shared === true);

  async function handleDeleteConfirm() {
    if (!isDeleteEnabled) return;
    try {
      await deleteProject(project.id);
    } catch (error) {
      console.error("Failed to delete project:", error);
    } finally {
      showDeleteModal = false;
      confirmationText = "";
    }
  }

  function handleDeleteCancel() {
    showDeleteModal = false;
    confirmationText = "";
  }
</script>

<div class="d-flex border rounded mb-4 p-3 gap-2 position-relative">
  <div class="d-flex w-50 gap-2">
    <div
      class="bg-success-subtle rounded px-3 d-flex align-items-center justify-content-center"
    >
      <i class="bi bi-file-text"></i>
    </div>

    <div class="d-flex flex-column">
      <a href="/projects/{project.id}">
        {project.title?.content || "Connecting/Downloading Project..."}
      </a>
      <p class="fs-7 mb-0 text-muted d-flex align-items-center gap-2">
        <span class="d-inline-flex align-items-center">
          {#if project.is_shared}
            <i class="bi bi-people-fill me-1"></i> {t("project.shared", { fallback: "Shared" })}
          {:else}
            <i class="bi bi-lock-fill me-1"></i> {t("project.private", { fallback: "Private" })}
          {/if}
        </span>
        <span>&bull;</span>
        <span>
          {t("project.created-on", { fallback: "Created on" })}
          {project.created_at ? formatDate(+project.created_at, translationState.currentLocale) : '...'}
        </span>
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

  <!-- Three dots dropdown menu -->
  <div class="p-2">
    <BaseDropdownMenu
      bind:open={dropdownOpen}
      items={dropdownItems}
      triggerClass="btn btn-link text-secondary p-1"
      contentProps={{ style: "right: 0; left: auto; min-width: 150px;" }}
      side="bottom"
      align="end"
      sideOffset={4}
      alignOffset={0}
    >
      {#snippet trigger()}
        <i class="bi bi-three-dots-vertical"></i>
      {/snippet}
    </BaseDropdownMenu>
  </div>
</div>

<!-- Delete confirmation modal -->
{#if showDeleteModal}
  <BaseAlertDialog bind:open={showDeleteModal}>
    {#snippet title()}
      {t("project.delete-project", { fallback: "Delete Project" })}
    {/snippet}
    {#snippet description()}
      <p>
        {t("project.delete-confirmation", { 
          fallback: "Are you sure you want to delete this project? This action cannot be undone." 
        })}
      </p>
      {#if isSharedProject}
        <p class="text-warning-emphasis">
          {t("project.delete-shared-warning", {
            fallback: "Deleting a shared project removes it only from this computer. Other people will keep seeing it and can continue working on their copy."
          })}
        </p>
      {/if}
      <p class="fw-bold">{project.title?.content || "Connecting..."}</p>
      <p class="mb-2">
        {t("project.delete-type-name", {
          fallback: "To confirm, please type the project name below:"
        })}
      </p>
      <BaseInput
        bind:value={confirmationText}
        placeholder={project.title?.content || "Connecting..."}
      />
    {/snippet}
    {#snippet footer()}
      <button class="btn btn-secondary" onclick={handleDeleteCancel}>
        {t("common.cancel", { fallback: "Cancel" })}
      </button>
      <button 
        class="btn btn-danger" 
        onclick={handleDeleteConfirm}
        disabled={!isDeleteEnabled}
      >
        {t("common.delete", { fallback: "Delete" })}
      </button>
    {/snippet}
  </BaseAlertDialog>
{/if}
