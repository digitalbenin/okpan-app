<script>
  import HeaderSwitch from "$lib/components/projects/HeaderSwitch.svelte";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getUserPresenceStore } from "$lib/stores/UserPresenceStore.svelte.js";
  import { page } from "$app/state";
  import { goto, invalidateAll } from "$app/navigation";
  import { deleteProject } from "$lib/stores/ProjectsUtils.js";
  import { onMount } from "svelte";

  const { t } = getTranslationStore();
  const project = $derived(page.data.project);
  const userPresenceStore = getUserPresenceStore();
  const userPresenceState = userPresenceStore.state;
  const currentUsername = $derived(userPresenceState.username || "Anonymous");
  const connectedPeers = $derived(userPresenceState.peers || []);

  let dropdownOpen = $state(false);
  let showDeleteModal = $state(false);
  let showSharingModal = $state(false);
  let idCopied = $state(false);
  let confirmationText = $state("");

  onMount(() => {
    void userPresenceStore.initialize();
  });

  function getInitial(username) {
    return username?.trim()?.charAt(0)?.toUpperCase() || "?";
  }

  function getAvatarStyle(username) {
    let hash = 0;

    for (const char of username || "") {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      hash |= 0;
    }

    const hue = Math.abs(hash) % 360;
    return `background: hsl(${hue} 68% 45%); color: white;`;
  }

  $effect(() => {
    if (!project?.id) {
      void userPresenceStore.setCurrentProject(null);
      return;
    }

    void userPresenceStore.setCurrentProject(project.id);
  });

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
      label: t("project.get-sharing-id", { fallback: "Get project sharing ID" }),
      icon: "share",
      onClick: () => {
        showSharingModal = true;
        idCopied = false;
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
    <div class="pe-3 d-flex justify-content-end align-items-center gap-2 flex-wrap">
      <span class="fw-semibold text-truncate current-username">{currentUsername}</span>
      {#if connectedPeers.length > 0}
        <div class="d-flex align-items-center gap-1">
          {#each connectedPeers as peer (peer.clientId)}
            <div
              class="peer-avatar"
              style={getAvatarStyle(peer.username)}
              title={peer.username}
              aria-label={peer.username}
            >
              {getInitial(peer.username)}
            </div>
          {/each}
        </div>
      {/if}
    </div>
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
        <button class="btn btn-outline-secondary" onclick={handleCopySharingId}>
          <i class={`bi bi-${idCopied ? 'check2 text-success' : 'clipboard'}`}></i> 
          {idCopied 
            ? t("common.copied", { fallback: "Copied!" }) 
            : t("common.copy", { fallback: "Copy" })}
        </button>
      </div>
      {#if idCopied}
        <p class="text-success small mb-0">
          ID copied to your clipboard.
        </p>
      {/if}
    {/snippet}
    {#snippet footer()}
      <button class="btn btn-secondary" onclick={() => (showSharingModal = false)}>
        {t("common.close", { fallback: "Close" })}
      </button>
    {/snippet}
  </BaseAlertDialog>
{/if}

<style>
  .current-username {
    max-width: 180px;
  }

  .peer-avatar {
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  }
</style>

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
