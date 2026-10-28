<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  let { projectId } = $props();

  const { t } = getTranslationStore();

  let isCopying = $state(false);
  let copied = $state(false);

  async function handleCopyProjectId() {
    if (!projectId || isCopying) return;
    try {
      isCopying = true;
      await navigator.clipboard.writeText(projectId);
      copied = true;
      setTimeout(() => { copied = false; }, 2500);
    } catch (error) {
      console.error("Failed to copy project ID:", error);
    } finally {
      isCopying = false;
    }
  }
</script>

<div class="mb-4">
  <label class="form-label mb-2" for="project-sharing-id">{t("share-project.project-link", { fallback: "Project link" })}</label>
  <div class="input-group">
    <input id="project-sharing-id" class="form-control" type="text" value={projectId} readonly />
    <button class="btn btn-outline-secondary" type="button" onclick={handleCopyProjectId} disabled={isCopying}>
      {copied ? t("share-project.copied", { fallback: "Copied" }) : t("share-project.copy-to-clipboard", { fallback: "Copy to clipboard" })}
    </button>
  </div>
  <p class="text-muted mt-3 mb-0" style="max-width: 42rem;">
    {t("share-project.join-instruction", { fallback: "To join a project, go to the new project page, select Import from URL, and paste the link." })}
  </p>
</div>
