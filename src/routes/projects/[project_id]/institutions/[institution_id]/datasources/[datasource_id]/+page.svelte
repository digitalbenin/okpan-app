<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import DatasourceEditForm from "$lib/components/datasources/DatasourceEditForm.svelte";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
  import { deleteDatasource, getObjectsByDatasource } from "$lib/stores/DatasourcesUtils.js";
  import { getObjectImageUrl } from "$lib/utils/media.js";
  import { goto } from "$app/navigation";
  import { back } from "$lib/utils/navigation.js";
  import { getObjectIdentifier } from "$lib/utils/objects.js";

  const translationStore = getTranslationStore();
  const t = $derived(translationStore.t);

  // Props
  const { data } = $props();

  // Derived - route params and data
  const projectId = $derived(data.projectId);
  const institutionId = $derived(data.institutionId);
  const datasourceId = $derived(data.datasourceId);
  const datasource = $derived(Array.isArray(data.datasource) ? data.datasource[0] || {} : data.datasource || {});
  const languages = $derived(data.languages || []);

  // Pagination state
  let page = $state(1);
  let pageSize = $state(10);
  let objects = $state(data.objects?.items || []);
  let totalCount = $state(data.objects?.totalCount || 0);
  let isLoadingObjects = $state(false);
  let _prevPage = $state(1);

  const totalPages = $derived(Math.ceil((totalCount || 0) / Math.max(1, pageSize || 10)));

  // Helper - load objects with pagination
  const loadObjects = async () => {
    isLoadingObjects = true;
    try {
      const { items, totalCount: tc } = await getObjectsByDatasource({ datasourceId, projectId, institutionId, page: Math.max(0, (page || 1) - 1), pageSize });
      objects = items || [];
      totalCount = tc || 0;
    } catch (e) {
      objects = [];
      totalCount = 0;
    } finally {
      isLoadingObjects = false;
    }
  };

  // Form instance binding
  let form = $state(null);
  const formStore = $derived(form?.useStore ? form.useStore((state) => state) : null);

  // Delete state and handlers
  let deleting = $state(false);
  let showDeleteModal = $state(false);

  const openDeleteModal = () => { showDeleteModal = true; };
  const cancelDelete = () => { showDeleteModal = false; };
  
  const handleDelete = async () => {
    if (!datasourceId) {
      showDeleteModal = false;
      return;
    }
    deleting = true;
    try {
      const res = await deleteDatasource(datasourceId);
      if (!res?.error) await goto(`/projects/${projectId}/institutions/${institutionId}`);
    } finally {
      deleting = false;
      showDeleteModal = false;
    }
  };

  // Watch for page changes and reload objects
  $effect(() => {
    if (page !== _prevPage) {
      _prevPage = page;
      loadObjects();
    }
  });
</script>

<PageActionFooter
  formStore={formStore}
  leftButtons={[
    {
      text: t("common.back", { fallback: "Back" }),
      class: "btn btn-outline-secondary",
      onClick: back,
    },
      {
      text: t("common.delete", { fallback: "Delete datasource" }),
      class: "btn btn-outline-danger",
      icon: "trash",
      disabled: deleting,
      onClick: openDeleteModal,
    }
  ]}
  rightButtons={[
  
    {
      text: t("common.save", { fallback: "Save" }),
      class: "btn btn-primary",
      onClick: () => form.handleSubmit(),
      disableOnError: true,
    },
  ]}
>
  <div class="container-fluid">
    <div class="row mb-2">
      <div class="col-12">
        <div class="d-flex align-items-center justify-content-between mt-4" style="overflow: visible;">
          <button
            class="btn btn-link text-decoration-none px-0"
            aria-label={t("common.back", { fallback: "Back" })}
            onclick={back}
          >
            <i class="bi bi-arrow-left"></i>
            {data.institution?.name?.content}
          </button>
        </div>

        <div class="mt-2">
          <h1 class="mb-1">
            {datasource?.name?.content ||
              t("common.unnamed", { fallback: "Unnamed" })}
          </h1>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <!-- Left column: edit form -->
      <div class="col-12 col-lg-8">
        <div class="card border-0 mb-1">
          <div class="card-body">
            <DatasourceEditForm 
              {datasource}
              {languages}
              {institutionId}
              bind:form
            />
          </div>
        </div>

      </div>

      <!-- Right column: imported objects list -->
      <div class="col-12 col-lg-4">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h2 class="h5 mb-0">{t("common.imported-objects", { fallback: "Imported objects" })} ({totalCount})</h2>
        </div>

        <div class="list-group rounded-3">
          {#if isLoadingObjects}
            <div class="text-center py-4 text-muted">{t("common.loading", { fallback: "Loading..." })}</div>
          {:else if objects.length === 0}
            <div class="text-center py-4 text-muted">{t("common.no-results", { fallback: "No results" })}</div>
          {:else}
            {#each objects as obj}
              <div class="list-group-item list-group-item-action py-2">
                <div class="d-flex align-items-center gap-3">
                  <BaseImage src={getObjectImageUrl(obj)} alt={getObjectIdentifier(obj) || "Object"} width={60} height={60} class="rounded border" />
                  <div class="flex-grow-1 text-truncate">
                    <div class="fw-semibold text-truncate">{getObjectIdentifier(obj)}</div>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        </div>

        {#if totalPages > 1}
          <div class="d-flex justify-content-end mt-3">
            <BasePagination bind:page {pageSize} count={totalCount} size="sm" />
          </div>
        {/if}
      </div>
    </div>
  </div>
</PageActionFooter>

{#if showDeleteModal}
  {#snippet header()}{t("common.confirm-delete", { fallback: "Confirm Deletion" })}{/snippet}

  {#snippet body()}
    <p>{t("common.confirm-delete-datasource", { fallback: "Are you sure you want to delete this datasource? This will also remove all linked ontology fields from objects." })}</p>
    <p class="text-danger">{t("common.operation-irreversible", { fallback: "This operation is irreversible." })}</p>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex justify-content-end gap-2">
      <BaseButton class="btn btn-secondary" text={t("common.cancel", { fallback: "Cancel" })} onClick={cancelDelete} disabled={deleting} />
      <BaseButton class="btn btn-danger" icon="trash" text={deleting ? t("common.deleting", { fallback: "Deleting..." }) : t("common.confirm-delete", { fallback: "Confirm delete" })} onClick={handleDelete} disabled={deleting} />
    </div>
  {/snippet}

  <BaseModal bind:isOpen={showDeleteModal} size="md" {header} {body} {actions} />
{/if}
