<script>
  import { formatDate } from "$lib/utils/dates";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { deleteProject } from "$lib/api/ProjectsApi.js";
  import { IconUsers, IconDotsVertical, IconPhoto } from "@tabler/icons-svelte";

  const { project } = $props();
  const { t, translationState } = getTranslationStore();

  let dropdownOpen = $state(false);
  let showDeleteModal = $state(false);
  let confirmationText = $state("");

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      delete: t("common.delete", { fallback: "Delete" }),
      createdOn: t("project.created-on", { fallback: "Created on" }),
      objects: t("common.objects", { fallback: "Objects" }),
      assets: t("common.assets", { fallback: "Assets" }),
      institutions: t("common.institutions", { fallback: "Institutions" }),
      deleteProject: t("project.delete-project", { fallback: "Delete Project" }),
      deleteConfirmation: t("project.delete-confirmation", {
        fallback: "Are you sure you want to delete this project? This action cannot be undone.",
      }),
      deleteTypeName: t("project.delete-type-name", {
        fallback: "To confirm, please type the project name below:",
      }),
      cancel: t("common.cancel", { fallback: "Cancel" }),
    };
  });

  const dropdownItems = $derived([
    {
      label: i18n.delete,
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

<div
  class="bg-white border d-flex align-items-center justify-content-between p-2 w-100"
  style="border-color: #d5d6d0; border-radius: 16px;"
>
  <div class="d-flex gap-3 align-items-center">
    <div
      class="d-flex align-items-center justify-content-center flex-shrink-0"
      style="width: 64px; height: 64px; background-color: #f5f5f3; border-radius: 16px;"
    >
      <IconPhoto size={24} stroke={2} />
    </div>
    <div class="d-flex flex-column gap-1" style="width: 295px;">
      <a
        href="/projects/{project.id}"
        class="text-decoration-none"
        style="font-family: 'Crimson Pro', serif; font-size: 24px; line-height: 1.2; letter-spacing: -0.48px; color: #292927;"
      >
        {project.title?.content || "Connecting/Downloading Project..."}
      </a>
      <div class="d-flex gap-1 align-items-center" style="font-size: 14px; line-height: 1.5; color: rgba(29,34,38,0.75);">
        <IconUsers size={16} stroke={2} />
        <span>
          {#if isSharedProject}
            {t("project.shared", { fallback: "Shared project" })}
          {:else}
            {t("project.private", { fallback: "Private project" })}
          {/if}
        </span>
        <span>&bull;</span>
        <span>
          {i18n.createdOn}
          {project.created_at ? formatDate(+project.created_at, translationState.currentLocale) : '...'}
        </span>
      </div>
    </div>
  </div>

  <div class="d-flex gap-4 align-items-center">
    <div class="d-flex flex-column align-items-start">
      <span class="text-uppercase" style="font-size: 12px; letter-spacing: 0.24px; line-height: 1.2; color: rgba(29,34,38,0.75);">
        {i18n.objects}
      </span>
      <span style="font-size: 24px; line-height: 1.5; color: rgba(29,34,38,0.75);">
        {project.objectsCount ?? 0}
      </span>
    </div>
    <div class="d-flex flex-column align-items-start">
      <span class="text-uppercase" style="font-size: 12px; letter-spacing: 0.24px; line-height: 1.2; color: rgba(29,34,38,0.75);">
        {i18n.assets}
      </span>
      <span style="font-size: 24px; line-height: 1.5; color: rgba(29,34,38,0.75);">
        {project.assetsCount ?? 0}
      </span>
    </div>
    <div class="d-flex flex-column align-items-start">
      <span class="text-uppercase" style="font-size: 12px; letter-spacing: 0.24px; line-height: 1.2; color: rgba(29,34,38,0.75);">
        {i18n.institutions}
      </span>
      <span style="font-size: 24px; line-height: 1.5; color: rgba(29,34,38,0.75);">
        {project.institutionsCount ?? 0}
      </span>
    </div>
  </div>

  <BaseDropdownMenu
    bind:open={dropdownOpen}
    items={dropdownItems}
    triggerClass="btn btn-link p-1 border-0"
    contentProps={{ style: "right: 0; left: auto; min-width: 150px;" }}
    side="bottom"
    align="end"
    sideOffset={4}
    alignOffset={0}
  >
    {#snippet trigger()}
      <IconDotsVertical size={16} stroke={2} />
    {/snippet}
  </BaseDropdownMenu>
</div>

<!-- Delete confirmation modal -->
{#if showDeleteModal}
  <BaseAlertDialog bind:open={showDeleteModal}>
    {#snippet title()}
      {i18n.deleteProject}
    {/snippet}
    {#snippet description()}
      <p>
        {i18n.deleteConfirmation}
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
        {i18n.deleteTypeName}
      </p>
      <BaseInput
        bind:value={confirmationText}
        placeholder={project.title?.content || "Connecting..."}
      />
    {/snippet}
    {#snippet footer()}
      <button class="btn btn-secondary" onclick={handleDeleteCancel}>
        {i18n.cancel}
      </button>
      <button 
        class="btn btn-danger" 
        onclick={handleDeleteConfirm}
        disabled={!isDeleteEnabled}
      >
        {i18n.delete}
      </button>
    {/snippet}
  </BaseAlertDialog>
{/if}
