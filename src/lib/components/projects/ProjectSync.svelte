<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import { addToast } from "$lib/components/base/BaseToast.svelte";

  const { onSynced } = $props();

  let projectId = $state("");
  let isSyncing = $state(false);
  let statusMessage = $state("");

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
      statusMessage = "Setting current project...";

      const res = await window.electronAPI.setCurrentProject(projectId.trim());
      if (!res?.success) {
        throw new Error(res?.error || "Failed to set up project sync.");
      }

      statusMessage = "Connecting... waiting for peers...";

      // Poll for peers
      let peersFound = false;
      const startTime = Date.now();
      const TIMEOUT_MS = 10000; // 10 seconds timeout

      while (Date.now() - startTime < TIMEOUT_MS) {
        const peers = await window.electronAPI.getProjectPeers(projectId.trim());
        if (peers > 0) {
          peersFound = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (peersFound) {
        statusMessage = "Connected!";
        if (typeof onSynced === "function") {
          onSynced({ projectId: projectId.trim() });
        }
      } else {
        // Did not find peers in time
        // Provide user feedback
        addToast({
          data: {
            title: "Timeout",
            description: "No project found, or no user working on it.",
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

  {#if statusMessage}
    <div class="alert alert-info">
      {statusMessage}
    </div>
  {/if}

  <div class="d-flex justify-content-end">
    <BaseButton
      text={isSyncing ? "Syncing..." : "Sync Project"}
      class="btn btn-primary"
      disabled={isSyncing || !projectId.trim()}
      onClick={handleSyncProject}
    />
  </div>
</div>
