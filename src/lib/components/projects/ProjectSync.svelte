<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import SignalingServerField from "$lib/components/projects/SignalingServerField.svelte";
  import TurnSecretField from "$lib/components/projects/TurnSecretField.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { normalizeSignalingUrl } from "$lib/utils/signalingUrl.js";
  import { persistJoinConnectionSettings } from "$lib/api/SettingsApi.js";
  
  const { t } = getTranslationStore();

  const { onSynced, onTimeout = null } = $props();

  let projectId = $state("");
  let password = $state("");
  let useDedicatedServer = $state(false);
  let signalingServer = $state("");
  let turnSecret = $state("");
  let isSyncing = $state(false);
  let statusMessage = $state("");

  const signalingValidation = $derived(normalizeSignalingUrl(signalingServer));
  const dedicatedServerValid = $derived(
    !useDedicatedServer || (!!signalingServer.trim() && signalingValidation.ok)
  );

  function getNormalizedProjectId() {
    return projectId.trim();
  }

  async function waitForPeerPresence(targetProjectId) {
    const initialPresence = await window.api.getProjectPresence(targetProjectId);
    if ((initialPresence?.count || 0) > 0) {
      return true;
    }

    return new Promise((resolve) => {
      let settled = false;
      const timeoutId = setTimeout(() => finish(false), 40000);
      const removeListener = window.api.onProjectPresenceChanged(({ projectId: changedProjectId, presence }) => {
        if (changedProjectId === targetProjectId && (presence?.count || 0) > 0) {
          finish(true);
        }
      });

      function finish(result) {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        removeListener?.();
        resolve(result);
      }
    });
  }

  async function handleSyncProject() {
    if (!projectId.trim()) {
      addToast({
        data: {
          title: "Validation Error",
          description: "Please enter a Project ID.",
          type: "error",
        },
      });
      return;
    }

    try {
      isSyncing = true;
      const normalizedProjectId = getNormalizedProjectId();
      statusMessage = "Looking for peers";

      const dedicatedServer = useDedicatedServer ? signalingValidation.value : null;
      const dedicatedTurnSecret = useDedicatedServer ? (turnSecret.trim() || null) : null;
      const joinRes = await window.api.joinP2PProject(normalizedProjectId, password || null, dedicatedServer, dedicatedTurnSecret);
      if (!joinRes?.success) {
        throw new Error(joinRes?.error || "Failed to initialize project sync connection.");
      }

      const res = await window.api.setCurrentProject(normalizedProjectId);
      if (!res?.success) {
        throw new Error(res?.error || "Failed to set up project sync.");
      }

      const peersFound = await waitForPeerPresence(normalizedProjectId);

      if (peersFound) {
        statusMessage = "Initializing project";
        if (typeof onSynced === "function") {
          const synced = await onSynced({ projectId: normalizedProjectId });
          if (synced === false) {
            return;
          }
        }

        // The join values are only bootstrap hints: persist them when the
        // project still has no settings row after the first successful sync.
        await persistJoinConnectionSettings(normalizedProjectId, dedicatedServer, dedicatedTurnSecret);
      } else {
        // Did not find peers in time
        // Provide user feedback
        onTimeout?.();
        addToast({
          data: {
            title: "Timeout",
            description: t("projects.join-timeout-description", {
              fallback: "No project found, wrong password, or no users are currently online. If the project uses a custom signaling server, make sure it is set correctly.",
            }),
            type: "warning",
          }
        });
        statusMessage = "";
      }
    } catch (error) {
      console.error("Failed to sync project:", error);
      addToast({
        data: {
          title: "Error",
          description: `Failed to sync project: ${error.message}`,
          type: "error",
        },
      });
      statusMessage = "";
    } finally {
      isSyncing = false;
    }
  }
</script>

<div>
  <div class="mb-3">
    <p class="form-label">Project ID *</p>
    <BaseInput
      bind:value={projectId}
      placeholder="Enter Project ID to sync"
      disabled={isSyncing}
    />
  </div>

  <div class="mb-3">
    <p class="form-label">Password (Optional)</p>
    <BaseInput
      type="password"
      bind:value={password}
      placeholder="Enter project password if required"
      disabled={isSyncing}
    />
  </div>

  <div class="form-check form-switch mb-3">
    <input
      id="join-dedicated-server"
      class="form-check-input"
      type="checkbox"
      checked={useDedicatedServer}
      onchange={() => { useDedicatedServer = !useDedicatedServer; }}
      disabled={isSyncing}
    />
    <label class="form-check-label" for="join-dedicated-server">
      {t("signaling.use-dedicated-server", { fallback: "Use dedicated sharing server" })}
    </label>
  </div>

  {#if useDedicatedServer}
    <div class="mb-3">
      <SignalingServerField bind:value={signalingServer} disabled={isSyncing} />
    </div>

    <div class="mb-3">
      <TurnSecretField bind:value={turnSecret} disabled={isSyncing} />
    </div>
  {/if}

  {#if statusMessage}
    <div class="alert alert-info">
      {statusMessage}
    </div>
  {/if}

  <div class="d-flex justify-content-end">
    <BaseButton
      text={isSyncing ? t("project.syncing", { fallback: "Syncing..." }) : t("project.join-project", { fallback: "Join project" })}
      class="btn btn-primary"
        disabled={isSyncing || !projectId.trim() || !dedicatedServerValid}
      onClick={handleSyncProject}
    />
  </div>
</div>
