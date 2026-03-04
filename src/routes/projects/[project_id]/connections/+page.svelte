<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { addToast } from "$lib/components/base/BaseToast.svelte";
  import { goto, invalidateAll } from "$app/navigation";
  import BaseDropdownMenu from "$lib/components/base/BaseDropdownMenu.svelte";
  import AddConnectionTypeModal from "$lib/components/research_fields/AddConnectionTypeModal.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();
  const { languages } = data;
  let isImporting = $state(false);
  const hasConnectionTypes = $derived((data?.researchFields?.length || 0) > 0);

  // Helper for status text
  function getStatusText(field) {
    if (field.onwebsite === 1) {
      return t("common.published", { fallback: "Published" });
    }
    return t("common.not-published", { fallback: "Not published" });
  }

  async function handleExportConnections() {
    if (!window?.api?.exportConnections || !data?.project?.id) return;
    if (!hasConnectionTypes) return;
    try {
      const result = await window.api.exportConnections({ projectId: data.project.id });
      if (result && !result.canceled) {
        addToast({
          data: {
            type: "success",
            title: t("common.export", { fallback: "Export" }),
            description: t("common.export-success", { fallback: "Connections exported successfully." })
          }
        });
      }
    } catch (error) {
      console.error('Error exporting connections:', error);
    }
  }

  async function handleImportConnections() {
    if (!window?.api?.importConnections || !data?.project?.id) return;
    if (isImporting) return;
    isImporting = true;
    try {
      const result = await window.api.importConnections({ projectId: data.project.id });
      if (result && !result.canceled && result.success) {
        await invalidateAll();
      }
    } catch (error) {
      console.error('Error importing connections:', error);
    } finally {
      isImporting = false;
    }
  }
</script>

<div class="container-fluid h-100 bg-light">
  <!-- Header Section -->
  <div class="row pt-3 pb-3 border-bottom mb-4 align-items-center">
    <div class="col">
      <h2 class="m-0 d-flex align-items-center gap-2">
        <i class="bi bi-share-fill text-muted"></i>
        {t("project.connection-types", { fallback: "Connection types" })}
      </h2>
    </div>
    <div class="col-auto">
      <div class="d-flex align-items-center gap-2">
        {#if isImporting}
          <div class="d-flex align-items-center text-muted small me-1">
            <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
            {t("common.importing", { fallback: "Importing..." })}
          </div>
        {/if}
        
        <AddConnectionTypeModal projectId={data.project.id} languages={languages} />
        <BaseDropdownMenu
          align="end"
          side="bottom"
          sideOffset={4}
          alignOffset={0}
          contentProps={{ style: "right: 0; left: auto;" }}
          triggerClass="btn btn-light border d-flex align-items-center"
        >
          {#snippet trigger()}
            <i class="bi bi-three-dots"></i>
          {/snippet}
          {#snippet children({ close })}
            <button class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2" disabled={!hasConnectionTypes} onclick={() => { handleExportConnections(); close(); }}>
              <i class="bi bi-download"></i>
              {t("common.export", { fallback: "Export" })}
            </button>
            <button class="dropdown-item rounded px-2 py-1 cursor-pointer d-flex align-items-center gap-2" disabled={isImporting} onclick={() => { handleImportConnections(); close(); }}>
              {#if isImporting}
                <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
              {:else}
                <i class="bi bi-upload"></i>
              {/if}
              {t("common.import", { fallback: "Import" })}
            </button>
          {/snippet}
        </BaseDropdownMenu>
      </div>
    </div>
  </div>

  <!-- Cards Grid -->
  <div class="row g-4 mx-2">
    {#each data.researchFields || [] as field (field.id)}
      <div class="col-md-4">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="card h-100 shadow-sm"
          onclick={() => goto(`/projects/${data.project.id}/connections/${field.id}`)}
          style="cursor: pointer; transition: box-shadow 0.2s;"
          onmouseenter={(e) => e.currentTarget.classList.add('shadow')}
          onmouseleave={(e) => e.currentTarget.classList.remove('shadow')}
        >
          <div class="card-body d-flex flex-column justify-content-between p-4" style="min-height: 200px;">
            <h3 class="card-title fw-normal mb-4">{field.name?.content || t("common.untitled", {fallback: "Untitled"})}</h3>
            
            <div class="mt-auto">
              <div class="d-flex align-items-center gap-2 text-muted mb-1">
                {#if field.onwebsite !== 1}
                  <i class="bi bi-eye-slash"></i>
                {:else}
                  <i class="bi bi-eye"></i>
                {/if}
                <span>{getStatusText(field)}</span>
              </div>
              <div class="text-muted">
                {field.vocabularies?.length || 0} {t("common.connections", { fallback: "connections" })}
              </div>
            </div>
          </div>
        </div>
      </div>
    {/each}
    {#if (!data.researchFields || data.researchFields.length === 0)}
        <div class="col-12 text-center text-muted mt-4">
            {t("common.no-connections-found", { fallback: "No connection types found." })}
        </div>
    {/if}
  </div>
</div>
