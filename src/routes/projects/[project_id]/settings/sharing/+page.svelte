<script>
  import { invalidateAll } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { updateProjectSharingSettings } from "$lib/stores/ProjectsUtils.js";
  import { isSharedProject as getIsSharedProject } from "$lib/utils/projectSharing.js";

  const { t } = getTranslationStore();
  const { data } = $props();
  const project = $derived(data.project);

  let isExporting = $state(false);
  let exportResult = $state(null);
  let exportError = $state(null);
  let isCopyingProjectId = $state(false);
  let copiedProjectId = $state(false);
  let isSavingSharing = $state(false);
  let isSavingPassword = $state(false);
  let showProjectPassword = $state(false);
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);
  let passwordDialogOpen = $state(false);
  let passwordDialogMode = $state("create");
  let isSharedProject = $state(getIsSharedProject(data.project));
  let usePassword = $state(!!data.project?.password);
  let projectPassword = $state(data.project?.password || "");
  let currentPasswordInput = $state("");
  let newPasswordInput = $state("");
  let passwordFormError = $state("");

  const hasProjectPassword = $derived(!!projectPassword);
  const isMutatingSharing = $derived(isSavingSharing || isSavingPassword);
  const sharingLoadingMessage = $derived.by(() => {
    if (isSavingSharing) {
      return isSharedProject ?  "Enabling project sharing..." : "Switching project to private...";
    }

    if (isSavingPassword) {
      if (!hasProjectPassword && passwordDialogOpen) {
        return "Saving new password...";
      }

      return usePassword ? "Updating project password..." : "Removing project password...";
    }

    return "";
  });
  const sharedProjectCheckboxId = "shared-project-enabled";
  const projectLinkFieldId = "project-sharing-id";
  const projectPasswordFieldId = "project-password";
  const useProjectPasswordFieldId = "use-project-password";
  const currentPasswordFieldId = "current-project-password";
  const newPasswordFieldId = "new-project-password";

  async function handleExportProjectFile() {
    isExporting = true;
    exportError = null;
    exportResult = null;

    try {
      const result = await window.api.createBackup({
        project_id: data.project.id,
      });

      if (result.canceled) {
        exportResult = null;
      } else {
        exportResult = result;
      }
    } catch (error) {
      console.error("Error exporting project file:", error);
      exportError = error.message;
    } finally {
      isExporting = false;
    }
  }

  async function handleCopyProjectId() {
    if (!project?.id || isCopyingProjectId) {
      return;
    }

    try {
      isCopyingProjectId = true;
      await navigator.clipboard.writeText(project.id);
      copiedProjectId = true;
      setTimeout(() => {
        copiedProjectId = false;
      }, 2500);
    } catch (error) {
      console.error("Failed to copy project ID:", error);
      addToast({
        data: {
          title: "Sharing",
          description: "Failed to copy the project ID.",
          type: "error",
        },
      });
    } finally {
      isCopyingProjectId = false;
    }
  }

  function resetPasswordModal() {
    currentPasswordInput = "";
    newPasswordInput = "";
    passwordFormError = "";
    showCurrentPassword = false;
    showNewPassword = false;
  }

  function openPasswordModal() {
    passwordDialogMode = hasProjectPassword ? "change" : "create";
    passwordFormError = "";
    currentPasswordInput = "";
    newPasswordInput = "";
    passwordDialogOpen = true;
  }

  async function syncSharingRuntime(shared, passwordOverride = undefined) {
    try {
      if (shared) {
        await window.api.reconnectP2PProject(project.id, passwordOverride);
        return;
      }

      await window.api.suspendP2PProject(project.id);
    } catch (error) {
      console.warn("Failed to sync runtime sharing state:", error);
    }
  }

  async function persistSharedProjectState(nextIsShared, nextPassword = projectPassword || null) {
    const { error } = await updateProjectSharingSettings(project.id, {
      isShared: nextIsShared,
      password: nextPassword,
    });

    if (error) {
      throw new Error(error);
    }

    isSharedProject = nextIsShared;
    await syncSharingRuntime(nextIsShared, nextPassword);
    await invalidateAll();
  }

  async function persistProjectPassword(nextPassword) {
    const result = await window.api.setProjectPassword(project.id, nextPassword);
    if (!result?.success) {
      throw new Error(result?.error || "Failed to update the project password.");
    }

    projectPassword = nextPassword || "";
    usePassword = !!nextPassword;
    if (isSharedProject) {
      await syncSharingRuntime(true, nextPassword || null);
    }
  }

  async function handleToggleSharedProject(event) {
    const checked = event.currentTarget.checked;

    if (checked === isSharedProject) {
      return;
    }

    try {
      isSavingSharing = true;
      await persistSharedProjectState(checked, projectPassword || null);
      addToast({
        data: {
          title: checked ? "Project sharing enabled" : "Project made private",
          description: checked
            ? "This project is now shared with collaborators who have the project ID."
            : "This project is now private on this device.",
          type: "success",
        },
      });
    } catch (error) {
      console.error("Failed to update shared/private state:", error);
      isSharedProject = !checked;
      addToast({
        data: {
          title: "Sharing",
          description: error.message,
          type: "error",
        },
      });
    } finally {
      isSavingSharing = false;
    }
  }

  async function handleToggleUsePassword(event) {
    const checked = event.currentTarget.checked;

    if (!isSharedProject) {
      usePassword = !!projectPassword;
      return;
    }

    if (checked) {
      usePassword = true;
      openPasswordModal();
      return;
    }

    try {
      isSavingPassword = true;
      await persistProjectPassword(null);
      resetPasswordModal();
      await invalidateAll();
      addToast({
        data: {
          title: "Password removed",
          description: "This project no longer requires a password to join.",
          type: "success",
        },
      });
    } catch (error) {
      console.error("Failed to disable project password:", error);
      usePassword = true;
      addToast({
        data: {
          title: "Sharing",
          description: error.message,
          type: "error",
        },
      });
    } finally {
      isSavingPassword = false;
    }
  }

  function handlePasswordDialogClose() {
    passwordDialogOpen = false;
    passwordDialogMode = "create";
    if (!hasProjectPassword) {
      usePassword = false;
    }
    resetPasswordModal();
  }

  async function handleSavePassword() {
    const trimmedCurrent = currentPasswordInput.trim();
    const trimmedNew = newPasswordInput.trim();

    if (!trimmedNew) {
      passwordFormError = "Insert new password";
      return;
    }

    if (projectPassword && trimmedCurrent !== projectPassword) {
      passwordFormError = "Current password does not match the saved password.";
      return;
    }

    try {
      isSavingPassword = true;
      passwordFormError = "";
      passwordDialogOpen = false;
      passwordDialogMode = "create";
      await persistProjectPassword(trimmedNew);
      resetPasswordModal();
      await invalidateAll();
      addToast({
        data: {
          title: "Password updated",
          description: "The project password has been saved.",
          type: "success",
        },
      });
    } catch (error) {
      console.error("Failed to save project password:", error);
      passwordFormError = error.message;
    } finally {
      isSavingPassword = false;
    }
  }

  $effect(() => {
    if (isSavingSharing || isSavingPassword) {
      return;
    }

    isSharedProject = getIsSharedProject(project);
    projectPassword = project?.password || "";
    usePassword = !!project?.password;
  });
</script>

<div class="container-fluid">
  <div class="row">
    <div class="col-12 col-xl-10">
      <div class="pt-3 pb-2 mb-4">
        <h2 class="mt-0 mb-2">
          {t("settings.sharing", { fallback: "Sharing" })}
        </h2>
        <p class=" mb-0" style="max-width: 46rem;">
          {t("settings.sharing_description", {
            fallback: "Here you can configure sharing settings for your project. Multi usrer projects can be accessed by multiple collaborators simultaneously and are required for real-time collaboration features. Private projects are only accessible on this device and do not support real-time collaboration.",
          })}
        </p>
      </div>

      <div class="mb-5">
        <h5 class="mb-3">Sharing</h5>

        {#if isMutatingSharing}
          <div class="alert alert-success d-inline-flex align-items-center gap-2 mb-4" role="status" aria-live="polite">
            <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
            <span>{sharingLoadingMessage}</span>
          </div>
        {/if}

        <div class="d-flex align-items-center gap-2 mb-4">
          <div class="form-check m-0 d-flex align-items-center gap-2">
            <input
              id={sharedProjectCheckboxId}
              class="form-check-input mt-0"
              type="checkbox"
              checked={isSharedProject}
              disabled={isSavingSharing || isSavingPassword}
              onchange={handleToggleSharedProject}
            />
            <label class="form-check-label" for={sharedProjectCheckboxId}>Multi user project</label>
          </div>
          
        </div>

        {#if isSharedProject}
          <div class="mb-4">
            <label class="form-label mb-2" for={projectLinkFieldId}>Project link</label>
            <div class="input-group" style="max-width: 42rem;">
              <input id={projectLinkFieldId} class="form-control" type="text" value={project.id} readonly />
              <button class="btn btn-primary" type="button" onclick={handleCopyProjectId} disabled={isCopyingProjectId}>
                <span class="d-inline-flex align-items-center gap-2">
                  <span>{copiedProjectId ? "Copied" : "Copy to clipboard"}</span>
                  <i class={`bi ${copiedProjectId ? "bi-check2" : "bi-copy"}`}></i>
                </span>
              </button>
            </div>
            <p class="text-muted mt-3 mb-0" style="max-width: 42rem;">
              To join a project, go to the new project page, select <em>Import from URL</em>, and paste the link.
            </p>
          </div>

          <div class="mb-4" style="max-width: 42rem;">
            <h5 class="mb-3">Password settings</h5>

            <div class="form-check d-flex align-items-center gap-2 mb-3">
              <input
                id={useProjectPasswordFieldId}
                class="form-check-input mt-0"
                type="checkbox"
                checked={usePassword}
                disabled={isSavingPassword || isSavingSharing}
                onchange={handleToggleUsePassword}
              />
              <label class="form-check-label" for={useProjectPasswordFieldId}>Use password</label>
            </div>

            {#if hasProjectPassword}
              <div class="mb-3">
                <label class="form-label mb-2" for={projectPasswordFieldId}>Password</label>
                <div class="input-group">
                  <input
                    id={projectPasswordFieldId}
                    class="form-control"
                    type={showProjectPassword ? "text" : "password"}
                    value={projectPassword}
                    readonly
                  />
                  <button
                    class="btn btn-outline-secondary"
                    type="button"
                    onclick={() => {
                      showProjectPassword = !showProjectPassword;
                    }}
                    aria-label={showProjectPassword ? "Hide saved project password" : "Show saved project password"}
                    title={showProjectPassword ? "Hide password" : "Show password"}
                  >
                    <i class={`bi ${showProjectPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                  </button>
                </div>
              </div>

              <BaseButton
                text={isSavingPassword ? "Saving..." : "Change password"}
                icon="pencil-square"
                iconPosition="left"
                class="btn btn-outline-secondary"
                disabled={isSavingPassword || isSavingSharing}
                onClick={openPasswordModal}
              />
            {/if}
          </div>
        {:else}
          <p class="text-muted mb-0" style="max-width: 42rem;">
            This project is private. Enable sharing to generate a project link and optionally protect it with a password.
          </p>
        {/if}
      </div>

      <div class="mt-4">
        <h5>{t("settings.project_file", { fallback: "Share by project file" })}</h5>
        
        <div class="mt-3">
          <BaseButton
            text={t("settings.export_project_file", { fallback: "Export project file" })}
            icon="download"
            iconPosition="left"
            onClick={handleExportProjectFile}
            disabled={isExporting}
            class="btn btn-primary"
          />
        </div>

        {#if isExporting}
          <div class="mt-3">
            <div class="d-flex align-items-center">
              <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              {t("settings.exporting", { fallback: "Creating backup..." })}
            </div>
          </div>
        {/if}

        {#if exportResult}
          <div class="alert alert-success mt-3">
            <strong>{t("settings.export_success", { fallback: "Success!" })}</strong>
            <p class="mb-0">
              {t("settings.export_success_message", {
                fallback: "Project backup created successfully.",
              })}
            </p>
            <small class="text-muted">
              {t("settings.file_location", { fallback: "File:" })} {exportResult.filePath}
            </small>
            <div class="mt-2">
              <small>
                {t("settings.objects_backed_up", { fallback: "Objects:" })} {exportResult.metadata.counts.objects} |
                {t("settings.assets_backed_up", { fallback: "Assets:" })} {exportResult.copiedAssets}
              </small>
            </div>
          </div>
        {/if}

        {#if exportError}
          <div class="alert alert-danger mt-3">
            <strong>{t("settings.export_error", { fallback: "Error" })}</strong>
            <p class="mb-0">{exportError}</p>
          </div>
        {/if}

        <p class="text-muted mt-3">
          {t("settings.import_instruction", {
            fallback: "You can import this project file from Create new project → Import from file",
          })}
        </p>
      </div>
    </div>
  </div>
</div>

<BaseAlertDialog bind:open={passwordDialogOpen} size="lg">
  {#snippet title()}
    {passwordDialogMode === "change" ? "Change password" : "Set password"}
  {/snippet}

  {#snippet description()}
    <div class="pt-2">
      {#if passwordDialogMode === "change"}
        <div class="mb-4">
          <label class="form-label mb-2" for={currentPasswordFieldId}>Current password</label>
          <div class="input-group">
            <input
              id={currentPasswordFieldId}
              class="form-control"
              type={showCurrentPassword ? "text" : "password"}
              bind:value={currentPasswordInput}
              placeholder="Enter current password"
            />
            <button
              class="btn btn-outline-secondary"
              type="button"
              onclick={() => {
                showCurrentPassword = !showCurrentPassword;
              }}
              aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
              title={showCurrentPassword ? "Hide password" : "Show password"}
            >
              <i class={`bi ${showCurrentPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
            </button>
          </div>
        </div>
      {/if}

      <div class="mb-0">
        <label class="form-label mb-2" for={newPasswordFieldId}>New password</label>
        <div class="input-group">
          <input
            id={newPasswordFieldId}
            class="form-control"
            type={showNewPassword ? "text" : "password"}
            bind:value={newPasswordInput}
            placeholder="Type new password"
          />
          <button
            class="btn btn-outline-secondary"
            type="button"
            onclick={() => {
              showNewPassword = !showNewPassword;
            }}
            aria-label={showNewPassword ? "Hide new password" : "Show new password"}
            title={showNewPassword ? "Hide password" : "Show password"}
          >
            <i class={`bi ${showNewPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
          </button>
        </div>
      </div>

      {#if passwordFormError}
        <div class="alert alert-warning mt-4 mb-0 d-inline-flex align-items-center gap-2" role="alert">
          <i class="bi bi-exclamation-triangle-fill"></i>
          <span>{passwordFormError}</span>
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <BaseButton
      text="Cancel"
      class="btn btn-outline-secondary"
      disabled={isSavingPassword}
      onClick={handlePasswordDialogClose}
    />
    <BaseButton
      text={isSavingPassword ? "Saving..." : "Save"}
      class="btn btn-primary"
      loading={isSavingPassword}
      disabled={isSavingPassword}
      onClick={handleSavePassword}
    />
  {/snippet}
</BaseAlertDialog>
