<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  
  const { t } = getTranslationStore();

  const { onSynced, onTimeout = null } = $props();

  let projectId = $state("");
  let password = $state("");
  let isSyncing = $state(false);
  let statusMessage = $state("");

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

      const joinRes = await window.api.joinP2PProject(normalizedProjectId, password || null);
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
      } else {
        // Did not find peers in time
        // Provide user feedback
        onTimeout?.();
        addToast({
          data: {
            title: "Timeout",
            description: "No project found, wrong password, or no users are currently online.",
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

  {#if statusMessage}
    <div class="alert alert-info">
      {statusMessage}
    </div>
  {/if}

  <div class="d-flex justify-content-end">
    <BaseButton
      text={isSyncing ? t("project.syncing", { fallback: "Syncing..." }) : t("project.join-project", { fallback: "Join project" })}
      class="btn btn-primary"
      disabled={isSyncing || !projectId.trim()}
      onClick={handleSyncProject}
    />
  </div>
</div>
