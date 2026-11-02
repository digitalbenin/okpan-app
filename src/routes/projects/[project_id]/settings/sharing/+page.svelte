<script>
  import { IconSettings, IconDeviceFloppy } from "@tabler/icons-svelte";
  import { watch } from "runed";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { invalidateAll } from "$app/navigation";
  import { updateProjectSharingSettings } from "$lib/api/ProjectsApi.js";
  import { setProjectSignalingServer, setProjectTurnSecret } from "$lib/api/SettingsApi.js";
  import { normalizeSignalingUrl } from "$lib/utils/signalingUrl.js";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
  import PasswordDialog from "$lib/components/projects/PasswordDialog.svelte";
  import SignalingServerField from "$lib/components/projects/SignalingServerField.svelte";
  import TurnSecretField from "$lib/components/projects/TurnSecretField.svelte";
  import SharingHelpCard from "$lib/components/projects/SharingHelpCard.svelte";
  import SharingProjectLink from "$lib/components/projects/SharingProjectLink.svelte";

  const { t } = getTranslationStore();
  const { data } = $props();
  const project = $derived(data.project);

  let isSaving = $state(false);
  let showProjectPassword = $state(false);
  let passwordDialogOpen = $state(false);

  // Draft local state — only persisted on Confirm
  let draftIsShared = $state(false);
  let draftUsePassword = $state(false);
  let draftPassword = $state("");
  let draftUseDedicatedServer = $state(false);
  let draftSignalingUrl = $state("");
  let draftTurnSecret = $state("");

  const hasDraftPassword = $derived(!!draftPassword);
  const savedSignalingUrl = $derived(data.signalingServer || "");
  const savedTurnSecret = $derived(data.turnSecret || "");
  // When the dedicated server is off the hidden drafts are ignored and cleared on save.
  const effectiveSignalingUrl = $derived(draftUseDedicatedServer ? draftSignalingUrl : "");
  const effectiveTurnSecret = $derived(draftUseDedicatedServer ? draftTurnSecret : "");
  const signalingValidation = $derived(normalizeSignalingUrl(effectiveSignalingUrl));
  const dedicatedServerValid = $derived(
    !draftUseDedicatedServer || (!!effectiveSignalingUrl.trim() && signalingValidation.ok)
  );

  // Init draft from project data
  function initDraft() {
    draftIsShared = project?.is_shared === 1 || project?.is_shared === true;
    draftPassword = project?.password || "";
    draftUsePassword = !!project?.password;
    draftUseDedicatedServer = !!(savedSignalingUrl || savedTurnSecret);
    draftSignalingUrl = savedSignalingUrl;
    draftTurnSecret = savedTurnSecret;
  }

  watch(() => project, () => { initDraft(); });

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

      // Persist the connection settings before the runtime sync so the
      // reconnect already picks up the new values.
      if (draftIsShared && effectiveSignalingUrl !== savedSignalingUrl) {
        const { error: signalingError } = await setProjectSignalingServer(project.id, effectiveSignalingUrl);
        if (signalingError) throw new Error(signalingError);
      }

      if (draftIsShared && effectiveTurnSecret !== savedTurnSecret) {
        const { error: turnSecretError } = await setProjectTurnSecret(project.id, effectiveTurnSecret);
        if (turnSecretError) throw new Error(turnSecretError);
      }

      // Persistenza completata: la riconnessione P2P gira in background e non deve bloccare il salvataggio.
      void syncSharingRuntime(draftIsShared, nextPassword);

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
    draftPassword !== (project?.password || "") ||
    effectiveSignalingUrl !== savedSignalingUrl ||
    effectiveTurnSecret !== savedTurnSecret
  );

  const rightActionButtons = $derived([
    {
      id: "save-sharing-settings",
      text: isSaving ? t("common.saving", { fallback: "Saving..." }) : t("objects.save-changes", { fallback: "Save changes" }),
      class: "btn btn-success me-3",
      iconComponent: IconDeviceFloppy,
      type: "submit",
      disabled: isSaving || !hasChanges || !dedicatedServerValid,
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
            <SharingProjectLink projectId={project.id} />

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

            <div class="form-check d-flex align-items-center gap-2 mb-3">
              <input
                id="use-dedicated-server"
                class="form-check-input mt-0"
                type="checkbox"
                checked={draftUseDedicatedServer}
                onchange={() => { draftUseDedicatedServer = !draftUseDedicatedServer; }}
              />
              <label class="form-check-label" for="use-dedicated-server">
                {t("signaling.use-dedicated-server", { fallback: "Use dedicated sharing server" })}
              </label>
            </div>

            {#if draftUseDedicatedServer}
              <div class="mb-4">
                <SignalingServerField
                  bind:value={draftSignalingUrl}
                  disabled={isSaving}
                />
              </div>

              <div class="mb-4">
                <TurnSecretField
                  bind:value={draftTurnSecret}
                  disabled={isSaving}
                />
              </div>
            {/if}
          {:else}
            <p class="text-muted mb-0" style="max-width: 42rem;">
              {t("share-project.private-message", { fallback: "This project is private. Enable sharing to generate a project link and optionally protect it with a password." })}
            </p>
          {/if}
        </div>

      </div>
    </div>

    <div class="col-12 col-lg-4 col-xl-3">
      <SharingHelpCard />
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
