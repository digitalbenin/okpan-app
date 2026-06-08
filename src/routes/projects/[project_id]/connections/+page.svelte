<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { goto } from "$app/navigation";
  import { IconChartCircles } from "@tabler/icons-svelte";
  import AddConnectionTypeModal from "$lib/components/research_fields/AddConnectionTypeModal.svelte";
  import ConnectionTypeImportModal from "$lib/components/research_fields/ConnectionTypeImportModal.svelte";
  import PageHeader from "$lib/components/base/PageHeader.svelte";

  const { data } = $props();
  const { t } = getTranslationStore();

  function getStatusText(field) {
    if (field.onwebsite === 1) {
      return t("common.published", { fallback: "Published" });
    }
    return t("common.not-published", { fallback: "Not published" });
  }
</script>

<PageHeader
  icon={IconChartCircles}
  iconBgClass="bg-orange-100"
  iconColorClass="text-orange-400"
  title={t("project.connection-types", { fallback: "Connection types" })}
  description={t("project.connection-types-description", { fallback: "The types of relationships you can define between the objects in your collection." })}
/>

<div class="d-flex justify-content-end gap-2 mt-4 mb-3">
  <ConnectionTypeImportModal projectId={data.project.id} languages={data.languages} />
  <AddConnectionTypeModal projectId={data.project.id} languages={data.languages} />
</div>

<div class="row g-4">
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
