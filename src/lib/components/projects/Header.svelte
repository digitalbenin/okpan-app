<script>
  import HeaderSwitch from "$lib/components/projects/HeaderSwitch.svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import UserPresenceSummary from "$lib/components/projects/UserPresenceSummary.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { IconChevronUp, IconChevronDown } from "@tabler/icons-svelte";
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { deleteProject } from "$lib/api/ProjectsApi.js";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import { IconCirclePlus, IconArrowLeft, IconPencil, IconShare, IconTrash } from "@tabler/icons-svelte";

  const { t } = getTranslationStore();
  const project = $derived(page.data.project);

  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.userPresenceState;
  const currentUsername = $derived(userPresenceState.username || "Anonymous");

  let dropdownOpen = $state(false);
  let showDeleteModal = $state(false);
  let showSharingModal = $state(false);
  let idCopied = $state(false);
  let confirmationText = $state("");

  const dropdownItems = $derived([
    {
      label: t("header.all-projects", { fallback: "All projects" }),
      icon: IconArrowLeft,
      onClick: () => {
        goto("/");
      },
    },
    {
      type: "separator",
    },
    {
      label: t("project.new", { fallback: "New project" }),
      icon: IconCirclePlus,
      onClick: () => {
        goto("/?create=new");
      },
    },
    {
      label: t("project.edit-info", { fallback: "Edit project info" }),
      icon: IconPencil,
      onClick: () => {
        goto(`/projects/${project.id}/settings/general`);
      },
    },
    {
      label: t("project.get-sharing-id", { fallback: "Get project sharing ID" }),
      icon: IconShare,
      onClick: () => {
        showSharingModal = true;
        idCopied = false;
      },
    },
    {
      label: t("project.delete-project", { fallback: "Delete project" }),
      icon: IconTrash,
      onClick: () => {
        showDeleteModal = true;
        confirmationText = "";
      },
    },
  ]);

  const isDeleteEnabled = $derived(
    confirmationText.trim() === (project.title?.content || "").trim()
  );

  const isSharedProject = $derived(project?.is_shared === 1 || project?.is_shared === true);

  const titleContent = $derived(project.title?.content || "Connecting/Downloading Project...");
  const firstLetter = $derived(titleContent.charAt(0).toUpperCase());
  const websiteLogoAsset = $derived.by(() => {
    if (project.websiteLogoFormats && Object.keys(project.websiteLogoFormats).length > 0) {
      return { formats: project.websiteLogoFormats };
    }
    return null;
  });

  async function handleDeleteConfirm() {
    if (!isDeleteEnabled) return;
    try {
      await deleteProject(project.id);
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

  async function handleCopySharingId() {
    try {
      await navigator.clipboard.writeText(project.id);
      idCopied = true;
      setTimeout(() => { idCopied = false; }, 3000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  }
</script>

<div
  class="header w-100 d-flex justify-content-between align-items-center py-2 bg-white border-bottom border-gray-500 gap-2 px-4"
>
  <div class="col d-flex align-items-center">
    <div class="d-inline-flex rounded-1 p-1 px-2 align-items-center gap-1 bg-gray-300" style="height: 39px;">
      <BaseDropdownMenu
        bind:open={dropdownOpen}
        items={dropdownItems}
        triggerClass="btn btn-sm btn-link text-decoration-none d-flex align-items-center gap-1 p-0"
        contentProps={{ style: "min-width: 200px; left:-10px;" }}
        side="bottom"
        align="start"
        alignOffset={0}
        sideOffset={8}
        size="sm"
        menuClass="border border-secondary-subtle"
      >
        {#snippet trigger()}
          {#if websiteLogoAsset}
            <BaseImage
              asset={websiteLogoAsset}
              class="rounded-1 flex-shrink-0 me-2"
              width={30}
              height={30}
              objectFit="cover"
              preferredFormat="sm"
            />
          {:else}
            <div class="d-flex align-items-center justify-content-center rounded-1 flex-shrink-0 bg-secondary-subtle text-secondary fw-bold" style="width: 30px; height: 30px; font-size: 14px;">
              {firstLetter}
            </div>
          {/if}
        <span class="text-primary-emphasis">
            
            {project.title?.content || "Connecting/Downloading Project..."}
          </span>
          {#if dropdownOpen}
            <IconChevronUp size={14} stroke={2} class="text-primary-emphasis" />
          {:else}
            <IconChevronDown size={14} stroke={2} class="text-primary-emphasis" />
          {/if}
        {/snippet}
      </BaseDropdownMenu>
    </div>
  </div>

  <div class="col d-flex justify-content-center">
    <HeaderSwitch />
  </div>

  <div class="col d-flex justify-content-end" style="width: 204px;">
    {#if isSharedProject}
      <UserPresenceSummary projectId={project?.id} />
    {:else}
      <div class="btn btn-light d-flex align-items-center gap-2">
        <i class="bi bi-cloud-check text-body d-flex align-items-center justify-content-center fs-4"></i>
        <span class="fw-semibold text-body text-truncate" style="max-width: 140px;">{currentUsername}</span>
      </div>
    {/if}
  </div>
</div>

<!-- Sharing ID modal -->
{#if showSharingModal}
  <BaseAlertDialog bind:open={showSharingModal}>
    {#snippet title()}
      {t("project.sharing-id", { fallback: "Project Sharing ID" })}
    {/snippet}
    {#snippet description()}
      <p>
        {t("project.sharing-id-description", {
          fallback: "Share this ID with others so they can join your project sync session:"
        })}
      </p>
      <div class="input-group mb-3">
        <input type="text" class="form-control" value={project.id} readonly />
        <button class="btn btn-primary" onclick={handleCopySharingId}>
          <i class={`pe-2 bi bi-${idCopied ? 'check2' : 'clipboard'}`}></i>
          {idCopied
            ? t("common.copied", { fallback: "Copied!" })
            : t("common.copy", { fallback: "Copy" })}
        </button>
      </div>
    {/snippet}
    {#snippet footer()}
      <button class="btn btn-primary" onclick={() => (showSharingModal = false)}>
        {t("common.close", { fallback: "Close" })}
      </button>
    {/snippet}
  </BaseAlertDialog>
{/if}

<!-- Delete confirmation modal -->
{#if showDeleteModal}
  <BaseAlertDialog bind:open={showDeleteModal}>
    {#snippet title()}
      {t("project.delete-project", { fallback: "Delete project" })}
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
      <p class="fw-bold">{project.title?.content || "Connecting/Downloading Project..."}</p>
      <p class="mb-2">
        {t("project.delete-type-name", {
          fallback: "To confirm, please type the project name below:"
        })}
      </p>
      <BaseInput
        bind:value={confirmationText}
        placeholder={project.title?.content || "Connecting/Downloading Project..."}
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
