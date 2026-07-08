<script>
  import { IconSettings, IconBulb, IconDeviceFloppy } from "@tabler/icons-svelte";
  import { watch } from "runed";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { invalidateAll } from "$app/navigation";
  import { updateProjectSharingSettings } from "$lib/api/ProjectsApi.js";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
  import PasswordDialog from "$lib/components/projects/PasswordDialog.svelte";

  const { t } = getTranslationStore();
  const { data } = $props();
  const project = $derived(data.project);

  let isCopyingProjectId = $state(false);
  let copiedProjectId = $state(false);
  let isSaving = $state(false);
  let showProjectPassword = $state(false);
  let passwordDialogOpen = $state(false);

  // Draft local state — only persisted on Confirm
  let draftIsShared = $state(false);
  let draftUsePassword = $state(false);
  let draftPassword = $state("");

  const hasDraftPassword = $derived(!!draftPassword);

  // Init draft from project data
  function initDraft() {
    draftIsShared = project?.is_shared === 1 || project?.is_shared === true;
    draftPassword = project?.password || "";
    draftUsePassword = !!project?.password;
  }

  watch(() => project, () => { initDraft(); });

  async function handleCopyProjectId() {
    if (!project?.id || isCopyingProjectId) return;
    try {
      isCopyingProjectId = true;
      await navigator.clipboard.writeText(project.id);
      copiedProjectId = true;
      setTimeout(() => { copiedProjectId = false; }, 2500);
    } catch (error) {
      console.error("Failed to copy project ID:", error);
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

  async function persistProjectPassword(nextPassword) {
    const result = await window.api.setProjectPassword(project.id, nextPassword);
    if (!result?.success) throw new Error(result?.error || "Failed to update the project password.");
  }

  // Submit — save all draft changes at once
  async function handleSubmit(e) {
    e.preventDefault();
    if (isSaving) return;
    isSaving = true;

    try {
      const nextPassword = draftUsePassword ? draftPassword : null;

      const { error: sharingError } = await updateProjectSharingSettings(project.id, {
        isShared: draftIsShared,
        password: nextPassword,
      });
      if (sharingError) throw new Error(sharingError);

      if (nextPassword !== null) {
        await persistProjectPassword(nextPassword);
      } else if (project?.password) {
        await persistProjectPassword(null);
      }

      await syncSharingRuntime(draftIsShared, nextPassword);
      await invalidateAll();
    } catch (error) {
      console.error("Failed to save sharing settings:", error);
    } finally {
      isSaving = false;
    }
  }

  function openPasswordModal() {
    passwordDialogOpen = true;
  }

  function handlePasswordSave(newPassword) {
    draftPassword = newPassword;
    draftUsePassword = true;
    passwordDialogOpen = false;
  }

  function handlePasswordDialogClose() {
    if (!hasDraftPassword) {
      draftUsePassword = false;
    }
  }

  const hasChanges = $derived(
    draftIsShared !== (project?.is_shared === 1 || project?.is_shared === true) ||
    draftUsePassword !== (!!project?.password) ||
    draftPassword !== (project?.password || "")
  );

  const rightActionButtons = $derived([
    {
      id: "save-sharing-settings",
      text: isSaving ? t("common.saving", { fallback: "Saving..." }) : t("objects.save-changes", { fallback: "Save changes" }),
      class: "btn btn-success me-3",
      iconComponent: IconDeviceFloppy,
      type: "submit",
      disabled: isSaving || !hasChanges,
    },
  ]);
</script>

<form onsubmit={handleSubmit}>
<PageActionFooter contentClass="container-fluid p-0 m-0" rightButtons={rightActionButtons}>
  <!-- Heading section -->
<div class="bg-white border-bottom px-4 py-3 d-flex flex-column gap-2 mx-n4 mt-n4">
	<div class="d-flex flex-column gap-3">
		<div class="d-flex align-items-center gap-3">
			<div class="bg-gray-200 text-gray-500 rounded-4 d-flex align-items-center justify-content-center flex-shrink-0" style="width: 48px; height: 48px;">
				<IconSettings size={32} />
			</div>
			<h1 class="mb-0 flex-grow-1">{t("menu.share-project", { fallback: "Share project" })}</h1>
		</div>
		<p class="mb-0" style="font-size: 14px;">{t("share-project.page-description", { fallback: "Configure sharing settings for your project." })}</p>
	</div>
</div>
  <div class="row g-3 mt-2">
    <div class="col-12 col-lg-8 col-xl-9 min-w-0">
      <div class="bg-white rounded-3 p-4">

        <div class="mb-5">
          <p class="mb-3 text-uppercase">{t("share-project.section-title", { fallback: "Sharing" })}</p>

          <div class="d-flex align-items-center gap-2 mb-4">
            <div class="form-check m-0 d-flex align-items-center gap-2">
              <input
                id="shared-project-enabled"
                class="form-check-input mt-0"
                type="checkbox"
                checked={draftIsShared}
                onchange={() => { draftIsShared = !draftIsShared; }}
              />
              <label class="form-check-label" for="shared-project-enabled">{t("share-project.multi-user-project", { fallback: "Multi user project" })}</label>
            </div>
          </div>

          {#if draftIsShared}
            <div class="mb-4">
              <label class="form-label mb-2" for="project-sharing-id">{t("share-project.project-link", { fallback: "Project link" })}</label>
              <div class="input-group">
                <input id="project-sharing-id" class="form-control" type="text" value={project.id} readonly />
                <button class="btn btn-outline-secondary" type="button" onclick={handleCopyProjectId} disabled={isCopyingProjectId}>
                  {copiedProjectId ? t("share-project.copied", { fallback: "Copied" }) : t("share-project.copy-to-clipboard", { fallback: "Copy to clipboard" })}
                </button>
              </div>
              <p class="text-muted mt-3 mb-0" style="max-width: 42rem;">
                {t("share-project.join-instruction", { fallback: "To join a project, go to the new project page, select Import from URL, and paste the link." })}
              </p>
            </div>

            <div class="mb-4">
              <div class="form-check d-flex align-items-center gap-2 mb-3">
                <input
                  id="use-project-password"
                  class="form-check-input mt-0"
                  type="checkbox"
                  checked={draftUsePassword}
                  onchange={() => {
                    if (!draftUsePassword) {
                      draftUsePassword = true;
                      passwordDialogOpen = true;
                    } else {
                      draftUsePassword = false;
                      draftPassword = "";
                    }
                  }}
                />
                <label class="form-check-label" for="use-project-password">{t("share-project.use-password", { fallback: "Use password" })}</label>
              </div>

              {#if hasDraftPassword}
                <div class="mb-3">
                  <label class="form-label mb-2" for="project-password">{t("share-project.password", { fallback: "Password" })}</label>
                  <div class="input-group">
                    <input
                      id="project-password"
                      class="form-control"
                      type={showProjectPassword ? "text" : "password"}
                      value={draftPassword}
                      readonly
                    />
                    <button
                      class="btn btn-outline-secondary"
                      type="button"
                      onclick={() => { showProjectPassword = !showProjectPassword; }}
                    >
                      {showProjectPassword ? t("share-project.hide-password", { fallback: "Hide password" }) : t("share-project.show-password", { fallback: "Show password" })}
                    </button>
                  </div>
                </div>

                <BaseButton
                  text={t("share-project.change-password", { fallback: "Change password" })}
                  icon="pencil-square"
                  iconPosition="left"
                  class="btn btn-outline-secondary"
                  onClick={openPasswordModal}
                />
              {/if}
            </div>
          {:else}
            <p class="text-muted mb-0" style="max-width: 42rem;">
              {t("share-project.private-message", { fallback: "This project is private. Enable sharing to generate a project link and optionally protect it with a password." })}
            </p>
          {/if}
        </div>

      </div>
    </div>

    <div class="col-12 col-lg-4 col-xl-3">
      <div class="bg-white border rounded-3 p-4 d-flex flex-column">
        <div class="d-flex flex-column gap-1">
          <div class="flex-shrink-0">
            <IconBulb size={16} stroke={2} />
          </div>
          <div>
            <p class="fw-semibold mb-1 text-body">{t("share-project.help-title", { fallback: "Sharing?" })}</p>
            <div class="text-body-secondary fs-7">
              <p class="mb-3">{t("share-project.help-desc-p1", { fallback: "Here you can configure sharing settings for your project. Multi user projects can be accessed by multiple collaborators simultaneously and are required for real-time collaboration features." })}</p>
              <p class="mb-0">{t("share-project.help-desc-p2", { fallback: "Private projects are only accessible on this device and do not support real-time collaboration." })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</PageActionFooter>
</form>

<PasswordDialog
  bind:open={passwordDialogOpen}
  currentSavedPassword={draftPassword}
  isSaving={false}
  onSave={handlePasswordSave}
  onClose={handlePasswordDialogClose}
/>
