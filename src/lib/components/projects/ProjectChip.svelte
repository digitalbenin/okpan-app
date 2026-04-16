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

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      delete: t("common.delete", { fallback: "Delete" }),
      createdOn: t("project.created-on", { fallback: "Created on" }),
      items: t("common.items", { fallback: "Items" }),
      assets: t("common.assets", { fallback: "Assets" }),
      collections: t("project.collections", { fallback: "Collections" }),
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
    confirmationText.trim() === project.title.content.trim()
  );

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
        {project.title.content}
      </a>
      <p class="fs-7 mb-0">
        {i18n.createdOn}
        {formatDate(+project.created_at, translationState.currentLocale)}
      </p>
    </div>
  </div>
  <div class="d-flex w-50">
    <div class="col">
      <div class="fs-7">{i18n.items}</div>
      <div class="fs-5">{project.objectsCount}</div>
    </div>
    <div class="col">
      <div class="fs-7">
        {i18n.assets}
      </div>
      <div class="fs-5">{project.assetsCount}</div>
    </div>
    <div class="col">
      <div class="fs-7">
        {i18n.collections}
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
      {i18n.deleteProject}
    {/snippet}
    {#snippet description()}
      <p>
        {i18n.deleteConfirmation}
      </p>
      <p class="fw-bold">{project.title.content}</p>
      <p class="mb-2">
        {i18n.deleteTypeName}
      </p>
      <BaseInput
        bind:value={confirmationText}
        placeholder={project.title.content}
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
