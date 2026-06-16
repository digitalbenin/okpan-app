<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  
  const { onImported = () => {} } = $props();
  const { t } = getTranslationStore();

  let selectedFile = $state(null);
  let fileName = $state("");
  let metadata = $state(null);
  let isDragging = $state(false);
  let isImporting = $state(false);
  let error = $state(null);
  let projectAlreadyExists = $state(false);

  async function handleBrowse() {
    try {
      const result = await window.api.selectBackupFile();
      if (result.success && result.filePath) {
        await selectFile(result.filePath, result.filePath.split(/[\\/]/).pop());
      }
    } catch (err) {
      console.error('[ProjectImport] Error selecting file:', err);
      error = err.message;
    }
  }

  async function selectFile(filePath, name) {
    selectedFile = filePath;
    fileName = name;
    error = null;
    metadata = null;
    projectAlreadyExists = false;

    try {
      const checkResult = await window.api.checkBackupFile({ filePath });
      if (checkResult.success && checkResult.metadata) {
        metadata = checkResult.metadata;
        if (checkResult.projectExists) {
          projectAlreadyExists = true;
        }
      } else {
        throw new Error(checkResult.error || "Invalid backup file");
      }
    } catch (err) {
      console.error('[ProjectImport] Error loading metadata:', err);
    }
  }

  async function handleImport() {
    if (!selectedFile) {
      error = "Please select a file first";
      return;
    }

    isImporting = true;
    error = null;

    try {
      const restoreResult = await window.api.restoreBackup({
        filePath: selectedFile,
        strategy: 'overwrite'
      });

      if (restoreResult.success) {
        onImported({ 
          projectId: restoreResult.project_id,
          metadata: restoreResult.metadata 
        });
      } else {
        throw new Error(restoreResult.error || "Failed to restore backup");
      }
    } catch (err) {
      console.error('[ProjectImport] Import error:', err);
      error = err.message;
      isImporting = false;
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(e) {
    e.preventDefault();
    isDragging = false;
  }

  function handleDrop(e) {
    e.preventDefault();
    isDragging = false;
    
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.dctx')) {
      error = "Please select a .dctx file";
      return;
    }
    
    const filePath = window.api.getPathForFile(file);
    if (!filePath) {
      error = "Unable to get file path. Please use the browse button.";
      return;
    }
    
    selectFile(filePath, file.name);
  }
</script>

<div class="import-container">
  <div 
    role="button"
    tabindex="0"
    class="border border-2 border-dashed rounded p-5 text-center bg-gray-200 {isDragging ? 'border-primary bg-primary-subtle' : ''}"
    style="transition: all 0.2s ease;"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
  >
    {#if selectedFile}
      <div class="text-primary mb-3">
        <i class="bi bi-file-earmark-zip fs-1 mb-3"></i>
        
        {#if metadata}
          <div class="mx-auto p-3 bg-light rounded-3 text-start" style="max-width: 500px;">
            <p class="fw-bold mb-2">{metadata.project_title || 'Untitled Project'}</p>
            <div class="small text-muted">
              <div><i class="bi bi-clock me-2"></i>Backed up: {new Date(metadata.created_at).toLocaleDateString()} at {new Date(metadata.created_at).toLocaleTimeString()}</div>
              {#if metadata.counts}
                <div class="mt-2">
                  <i class="bi bi-box me-2"></i>Objects: {metadata.counts.objects || 0} | 
                  <i class="bi bi-building ms-2 me-2"></i>Institutions: {metadata.counts.institutions || 0} | 
                  <i class="bi bi-image ms-2 me-2"></i>Assets: {metadata.counts.assets || 0}
                </div>
              {/if}
            </div>
            <div class="mt-2">
              <small class="text-muted fst-italic">{fileName}</small>
            </div>
          </div>
        {:else}
          <p class="mt-2 mb-0 fw-semibold">{fileName}</p>
          <div class="spinner-border spinner-border-sm text-primary mt-2" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        {/if}
      </div>
    {:else}
      <p class="text-muted mb-0">
        {t("project.drag-file", { fallback: "Drag a file here or" })}
        <button 
          class="btn btn-sm btn-primary mx-2" 
          onclick={handleBrowse}
          disabled={isImporting}
        >
          {t("common.browse", { fallback: "browse" })}
        </button>
        {t("project.file-from-computer", { fallback: "a file from your computer" })}
      </p>
    {/if}
  </div>

  {#if error}
    <div class="alert alert-danger mt-3" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      {error}
    </div>
  {/if}

  {#if projectAlreadyExists}
    <div class="alert alert-warning mt-3" role="alert">
      <i class="bi bi-exclamation-triangle me-2"></i>
      <strong>Project already exists.</strong> Importing will overwrite the existing project and all its data. Are you sure?
    </div>
  {/if}

  <div class="d-flex justify-content-end mt-4">
    {#if projectAlreadyExists && !isImporting}
      <button class="btn btn-outline-secondary btn-lg me-2" onclick={() => {
        onImported({ projectId: metadata.project_id, metadata });
      }}>
        {t("project.open-existing", { fallback: "Open existing instead" })}
      </button>
    {/if}
    <button
      class="btn btn-primary"
      onclick={handleImport}
      disabled={!selectedFile || isImporting}
    >
      {#if isImporting}
        <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
        {t("project.importing", { fallback: "Importing..." })}
      {:else if projectAlreadyExists}
        {t("project.overwrite", { fallback: "Overwrite project" })}
      {:else}
        {t("project.import-project", { fallback: "Import project" })}
      {/if}
    </button>
  </div>
</div>
