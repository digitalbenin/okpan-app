<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { goto } from "$app/navigation";

  const { data } = $props();
  const { t } = getTranslationStore();

  // Helper for status text
  function getStatusText(field) {
    if (field.onwebsite === 1) {
      return t("common.published", { fallback: "Published" });
    }
    return t("common.not-published", { fallback: "Not published" });
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
      <a
          class="btn btn-secondary text-white"
          href="/projects/{data.project.id}/data-structure/research-fields/add?type=vocabulary"
        >
        <i class="bi bi-plus-lg me-1"></i>
        {t("common.add-connection-type", { fallback: "Add connection type" })}
      </a>
    </div>
  </div>

  <!-- Cards Grid -->
  <div class="row g-4 mt-4">
    {#each data.researchFields || [] as field (field.id)}
      <div class="col-md-4 mb-4">
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="card h-100 shadow-sm"
          onclick={() => goto(`/projects/${data.project.id}/data-structure/research-fields/${field.id}`)}
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
