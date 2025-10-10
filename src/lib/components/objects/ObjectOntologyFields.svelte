<script>
  import { Tabs } from "melt/builders";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseBadge from "$lib/components/base/BaseBadge.svelte";

  // Props
  const { object } = $props();

  const { t } = getTranslationStore();

  // Get object's ontology fields grouped by datasource
  const ontologyFields = $derived(object?.objectsOntologyFields || []);

  // Group ontology fields by datasource
  const fieldsByDatasource = $derived.by(() => {
    const groups = new Map();

    ontologyFields.forEach((field) => {
      const id = field.datasources_id || "no-datasource";
      const name =
        field.datasource?.name?.content ||
        t("common.no-datasource", { fallback: "No Datasource" });

      if (!groups.has(id)) groups.set(id, { id, name, fields: [] });
      groups.get(id).fields.push(field);
    });

    return Array.from(groups.values());
  });

  // Tab state and initialization
  const activeTabId = $derived(fieldsByDatasource[0]?.id || null);
  const tabs = new Tabs({ value: () => activeTabId });

  // Text truncation logic
  let expandedFields = $state(new Set());
  const shouldTruncate = (text) => text?.length > 160;
  const isExpanded = (fieldId) => expandedFields.has(fieldId);

  const toggleExpanded = (fieldId) => {
    expandedFields.has(fieldId)
      ? expandedFields.delete(fieldId)
      : expandedFields.add(fieldId);
    expandedFields = new Set(expandedFields);
  };

  const getDisplayText = (fieldId, text) => {
    if (!text) return "";
    if (!shouldTruncate(text)) return text;
    return isExpanded(fieldId) ? text : text.substring(0, 160) + "...";
  };
</script>

<div class="bg-white mb-2 px-2">
  <div class="d-flex justify-content-between align-items-center mb-3">
    <h3 class="mb-0">
      {t("objects.institution_data.title", {
        fallback: "Institution Data",
      })}
    </h3>
  </div>

  {#if fieldsByDatasource.length > 0}
    <!-- Tab Navigation -->
    <ul class="nav nav-underline mb-3 border-bottom" {...tabs.triggerList}>
      {#each fieldsByDatasource as datasource}
        <li class="nav-item">
          <button
            {...tabs.getTrigger(datasource.id)}
            type="button"
            class="nav-link"
            class:active={datasource.id === tabs.value}
            role="tab"
            aria-selected={datasource.id === tabs.value}
          >
            {datasource.name}
          </button>
        </li>
      {/each}
    </ul>

    <!-- Tab Content -->
    {#each fieldsByDatasource as datasource}
      <div {...tabs.getContent(datasource.id)}>
        {#if datasource.fields.length > 0}
          <table class="table table-borderless">
            <thead>
              <tr class="border-bottom">
                <th scope="col" class="fw-normal text-muted"
                  >Institution field</th
                >
                <th scope="col" class="fw-normal text-muted">Linked field</th>
                <th scope="col" class="fw-normal text-muted">Value</th>
              </tr>
            </thead>
            <tbody>
              {#each datasource.fields as field (field.id)}
                <tr class="border-bottom">
                  <td class="align-middle">
                    {field.label || "Untitled Field"}
                    {#if field.primary}
                      <!-- <span
                                                class="badge bg-primary text-white ms-2"
                                                >Primary</span
                                            > -->
                    {/if}
                  </td>
                  <td class="align-middle">
                    <div class="d-flex align-items-center">
                      <span class="text-muted me-2">Matched to</span>
                      <i class="bi bi-arrow-right text-muted me-2"></i>
                      <BaseBadge
                        value={field.ontologyField?.name?.content ||
                          field.label ||
                          "Unknown"}
                        class="bg-secondary-subtle text-dark"
                      />
                    </div>
                  </td>
                  <td class="align-middle">
                    {#if field.value}
                      <span>{getDisplayText(field.id, field.value)}</span>
                      {#if shouldTruncate(field.value)}
                        <button
                          type="button"
                          class="btn btn-link btn-sm p-0 ms-2 text-decoration-none"
                          onclick={() => toggleExpanded(field.id)}
                        >
                          {isExpanded(field.id) ? "read less" : "read more"}
                        </button>
                      {/if}
                    {:else}
                      <span class="text-muted fst-italic">Value field</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="text-center text-muted py-4">
            No ontology fields for this datasource
          </div>
        {/if}
      </div>
    {/each}
  {:else}
    <div class="text-center text-muted py-4">
      <i class="bi bi-database fs-1 opacity-50"></i>
      <div class="mt-2">
        {t("objects.no-institution-data-found", {
          fallback: "No institution data found for this object",
        })}
      </div>
    </div>
  {/if}
</div>

<style>
  [data-melt-tabs-trigger] {
    background: none;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem 0.25rem 0 0;
    cursor: pointer;
    border-bottom: 1px solid transparent; /* Add transparent bottom border */
    margin-bottom: -1px; /* Overlap the main border */
  }

  /* Style the active/selected tab */
  [data-melt-tabs-trigger][data-state="active"] {
    border: 1px solid #dee2e6;
    border-bottom-color: white;
    background-color: white;
    /* Ensure active tab text matches Bootstrap's active link style */
    color: var(--bs-nav-tabs-link-active-color, #495057);
  }

  [data-melt-tabs-trigger]:not([data-state="active"]) {
    color: var(--bs-nav-link-color, #0d6efd); /* Default Bootstrap link color */
  }

  [data-melt-tabs-trigger]:hover:not([data-state="active"]) {
    border-color: var(--bs-border-color-translucent, #dee2e6);
    color: var(
      --bs-nav-link-hover-color,
      #0a58ca
    ); /* Default Bootstrap link hover color */
  }

  [data-melt-tabs-content] {
    padding: 1rem 0;
    /* Melt UI hides non-active content automatically, no need for display:none */
  }

  /* Keep nav-tabs styling for the container */
  .nav-tabs {
    display: flex;
    border-bottom: 1px solid #dee2e6;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .nav-underline .nav-link.active,
  .nav-underline .show > .nav-link {
    font-weight: 400 !important;
  }
</style>
