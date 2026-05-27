<script>
  import { invalidateAll } from "$app/navigation";
  import { watch } from "runed";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { updateProjectSharingSettings } from "$lib/api/ProjectsApi.js";
  import PasswordDialog from "$lib/components/projects/PasswordDialog.svelte";

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
  let passwordDialogOpen = $state(false);
  let isSharedProject = $state(data.project?.is_shared === 1 || data.project?.is_shared === true);
  let usePassword = $state(!!data.project?.password);
  let projectPassword = $state(data.project?.password || "");

  const hasProjectPassword = $derived(!!projectPassword);
  const isMutatingSharing = $derived(isSavingSharing || isSavingPassword);
  const sharingLoadingMessage = $derived.by(() => {
    if (isSavingSharing) {
      return isSharedProject ? "Enabling project sharing..." : "Switching project to private...";
    }
    if (isSavingPassword) {
      return usePassword ? "Updating project password..." : "Removing project password...";
    }
    return "";
  });

  // Sync from reloaded data when not mid-save (after invalidateAll resolves).
  watch(
    () => project,
    () => {
      if (isSavingSharing || isSavingPassword) return;
      isSharedProject = project?.is_shared === 1 || project?.is_shared === true;
      projectPassword = project?.password || "";
      usePassword = !!project?.password;
    }
  );

  async function handleExportProjectFile() {
    isExporting = true;
    exportError = null;
    exportResult = null;
    try {
      const result = await window.api.createBackup({ project_id: data.project.id });
      exportResult = result.canceled ? null : result;
    } catch (error) {
      console.error("Error exporting project file:", error);
      exportError = error.message;
    } finally {
      isExporting = false;
    }
  }

  async function handleCopyProjectId() {
    if (!project?.id || isCopyingProjectId) return;
    try {
      isCopyingProjectId = true;
      await navigator.clipboard.writeText(project.id);
      copiedProjectId = true;
      setTimeout(() => { copiedProjectId = false; }, 2500);
    } catch (error) {
      console.error("Failed to copy project ID:", error);
      addToast({ data: { title: "Sharing", description: "Failed to copy the project ID.", type: "error" } });
    } finally {
      isCopyingProjectId = false;
    }
  }

  async function syncSharingRuntime(shared, passwordOverride = undefined) {
    try {
      if (shared) {
        await window.api.reconnectP2PProject(project.id, passwordOverride);
      } else {
        await window.api.suspendP2PProject(project.id);
      }
    } catch (error) {
      console.warn("Failed to sync runtime sharing state:", error);
    }
  }

  async function persistSharedProjectState(nextIsShared, nextPassword = projectPassword || null) {
    const { error } = await updateProjectSharingSettings(project.id, { isShared: nextIsShared, password: nextPassword });
    if (error) throw new Error(error);
    isSharedProject = nextIsShared;
    await syncSharingRuntime(nextIsShared, nextPassword);
    await invalidateAll();
  }

  async function persistProjectPassword(nextPassword) {
    const result = await window.api.setProjectPassword(project.id, nextPassword);
    if (!result?.success) throw new Error(result?.error || "Failed to update the project password.");
    projectPassword = nextPassword || "";
    usePassword = !!nextPassword;
    if (isSharedProject) {
      await syncSharingRuntime(true, nextPassword || null);
    }
  }

  async function handleToggleSharedProject(event) {
    const checked = event.currentTarget.checked;
    if (checked === isSharedProject) return;
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
      addToast({ data: { title: "Sharing", description: error.message, type: "error" } });
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
      passwordDialogOpen = true;
      return;
    }
    try {
      isSavingPassword = true;
      await persistProjectPassword(null);
      await invalidateAll();
      addToast({ data: { title: "Password removed", description: "This project no longer requires a password to join.", type: "success" } });
    } catch (error) {
      console.error("Failed to disable project password:", error);
      usePassword = true;
      addToast({ data: { title: "Sharing", description: error.message, type: "error" } });
    } finally {
      isSavingPassword = false;
    }
  }

  async function handlePasswordSave(newPassword) {
    try {
      isSavingPassword = true;
      passwordDialogOpen = false;
      await persistProjectPassword(newPassword);
      await invalidateAll();
      addToast({ data: { title: "Password updated", description: "The project password has been saved.", type: "success" } });
    } catch (error) {
      console.error("Failed to save project password:", error);
      addToast({ data: { title: "Sharing", description: error.message, type: "error" } });
    } finally {
      isSavingPassword = false;
    }
  }

  function handlePasswordDialogClose() {
    if (!hasProjectPassword) {
      usePassword = false;
    }
  }
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
            fallback: "Here you can configure sharing settings for your project. Multi user projects can be accessed by multiple collaborators simultaneously and are required for real-time collaboration features. Private projects are only accessible on this device and do not support real-time collaboration.",
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
              id="shared-project-enabled"
              class="form-check-input mt-0"
              type="checkbox"
              checked={isSharedProject}
              disabled={isSavingSharing || isSavingPassword}
              onchange={handleToggleSharedProject}
            />
            <label class="form-check-label" for="shared-project-enabled">Multi user project</label>
          </div>
          
        </div>

        {#if isSharedProject}
          <div class="mb-4">
            <label class="form-label mb-2" for="project-sharing-id">Project link</label>
            <div class="input-group" style="max-width: 42rem;">
              <input id="project-sharing-id" class="form-control" type="text" value={project.id} readonly />
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
                id="use-project-password"
                class="form-check-input mt-0"
                type="checkbox"
                checked={usePassword}
                disabled={isSavingPassword || isSavingSharing}
                onchange={handleToggleUsePassword}
              />
              <label class="form-check-label" for="use-project-password">Use password</label>
            </div>

            {#if hasProjectPassword}
              <div class="mb-3">
                <label class="form-label mb-2" for="project-password">Password</label>
                <div class="input-group">
                  <input
                    id="project-password"
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
            text={t("settings.export_project_file")}
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
                <span class="visually-hidden">{t("common.loading")}</span>
              </div>
              {t("settings.exporting")}
            </div>
          </div>
        {/if}

        {#if exportResult}
          <div class="alert alert-success mt-3">
            <strong>{t("common.success")}</strong>
            <p class="mb-0">
              {t("settings.export_success_message")}
            </p>
            <small class="text-muted">
              {t("settings.file_location", { path: exportResult.filePath })}
            </small>
            <div class="mt-2">
              <small>
                {t("settings.backup_counts", {
                  objects: exportResult.metadata.counts.objects,
                  assets: exportResult.copiedAssets,
                })}
              </small>
            </div>
          </div>
        {/if}

        {#if exportError}
          <div class="alert alert-danger mt-3">
            <strong>{t("common.error")}</strong>
            <p class="mb-0">{exportError}</p>
          </div>
        {/if}

        <p class="text-muted mt-3">
          {t("settings.import_instruction")}
        </p>
      </div>
    </div>
  </div>
</div>

<PasswordDialog
  bind:open={passwordDialogOpen}
  currentSavedPassword={projectPassword}
  isSaving={isSavingPassword}
  onSave={handlePasswordSave}
  onClose={handlePasswordDialogClose}
/>
