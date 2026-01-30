<script>
  import HeaderSwitch from "$lib/components/projects/HeaderSwitch.svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { deleteProject } from "$lib/stores/ProjectsUtils.js";

  const { t } = getTranslationStore();
  const project = $derived(page.data.project);

  let dropdownOpen = $state(false);
  let showDeleteModal = $state(false);
  let confirmationText = $state("");

  const dropdownItems = $derived([
    {
      label: t("header.all-projects", { fallback: "All projects" }),
      icon: "arrow-left",
      onClick: () => {
        goto("/");
      },
    },
    {
      type: "separator",
    },
    {
      label: t("project.new", { fallback: "Start a new project" }),
      icon: "plus-circle",
      onClick: () => {
        // Navigate to projects page with create parameter
        goto("/?create=new");
      },
    },
    {
      label: t("project.edit-info", { fallback: "Edit project info" }),
      icon: "pencil",
      onClick: () => {
        goto(`/projects/${project.id}/settings/general`);
      },
    },
    {
      label: t("project.delete-project", { fallback: "Delete this project" }),
      icon: "trash",
      onClick: () => {
        showDeleteModal = true;
        confirmationText = "";
      },
    },
  ]);

  const isDeleteEnabled = $derived(
    confirmationText.trim() === project.title.content.trim()
  );

  async function handleDeleteConfirm() {
    if (!isDeleteEnabled) return;
    try {
      await deleteProject(project.id);
      // Navigate back to projects list after deletion
      await goto("/");
      await invalidateAll();
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
  class="header w-100 d-flex justify-content-between align-items-center py-2 text-bg-secondary border-bottom gap-2 px-1"
>
  <div class="col">
    <BaseDropdownMenu
      bind:open={dropdownOpen}
      items={dropdownItems}
      triggerClass="btn btn-secondary btn-sm d-flex align-items-center gap-2"
      contentProps={{ style: "left: 0; min-width: 200px;" }}
      side="bottom"
      align="start"
      sideOffset={4}
      alignOffset={0}
    >
      {#snippet trigger()}
        {project.title.content}
        <i class="bi bi-chevron-{dropdownOpen ? 'up' : 'down'}"></i>
      {/snippet}
    </BaseDropdownMenu>
  </div>
  <div class="col d-flex justify-content-center">
    <HeaderSwitch />
  </div>

  <div class="col text-end">
    <div class="pe-3">Username</div>
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
      <p class="fw-bold">{project.title.content}</p>
      <p class="mb-2">
        {t("project.delete-type-name", { 
          fallback: "To confirm, please type the project name below:" 
        })}
      </p>
      <BaseInput
        bind:value={confirmationText}
        placeholder={project.title.content}
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
