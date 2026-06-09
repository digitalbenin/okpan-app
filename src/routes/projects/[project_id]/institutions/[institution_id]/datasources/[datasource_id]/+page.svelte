<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseBreadcrumb from "$lib/components/base/BaseBreadcrumb.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import DatasourceEditForm from "$lib/components/datasources/DatasourceEditForm.svelte";
  import PageActionFooter from "$lib/components/common/PageActionFooter.svelte";
  import { IconDatabase } from "@tabler/icons-svelte";
  import { invalidate } from "$app/navigation";
  import { deleteDatasource, getObjectsByDatasource } from "$lib/api/DatasourcesApi.js";
  import { getObjectImageUrl } from "$lib/utils/media.js";
  import { goto } from "$app/navigation";
  import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";

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

  const breadcrumbItems = $derived([
    { label: t("common.institutions"), href: `/projects/${projectId}/institutions` },
    { label: data.institution?.name?.content || institutionId, href: `/projects/${projectId}/institutions/${institutionId}` },
    { label: t("common.data-sources"), href: `/projects/${projectId}/institutions/${institutionId}?view=datasources` },
    { label: datasource?.name?.content || t("common.unnamed") },
  ]);

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
      text: t("common.back"),
      class: "btn btn-outline-secondary",
      onClick: () => window.history.back(),
    },
      {
      text: t("common.delete"),
      class: "btn btn-outline-danger",
      icon: "trash",
      disabled: deleting,
      onClick: openDeleteModal,
    }
  ]}
  rightButtons={[
  
    {
      text: t("common.save"),
      class: "btn btn-primary",
      onClick: () => form.handleSubmit(),
      disableOnError: true,
    },
  ]}
>
  <div class="container-fluid">
    <div class="row mb-2">
      <div class="col-12">
        <div class="d-flex align-items-center justify-content-between" style="overflow: visible;">
          <BaseBreadcrumb icon={IconDatabase} items={breadcrumbItems} />
        </div>

        <div>
          <h1 class="mb-1">
            {datasource?.name?.content || t("common.unnamed")}
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
              onSuccess={() => invalidate('app:datasources')}
            />
          </div>
        </div>

      </div>

      <!-- Right column: imported objects list -->
      <div class="col-12 col-lg-4">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <h2 class="h5 mb-0">{t("common.imported-objects")} ({totalCount})</h2>
        </div>

        <div class="list-group rounded-3">
          {#if isLoadingObjects}
            <div class="text-center py-4 text-muted">{t("common.loading")}</div>
          {:else if objects.length === 0}
            <div class="text-center py-4 text-muted">{t("common.no-results")}</div>
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
  {#snippet header()}{t("common.confirm-delete")}{/snippet}

  {#snippet body()}
    <p>{t("common.confirm-delete-datasource")}</p>
    <p class="text-danger">{t("common.operation-irreversible")}</p>
  {/snippet}

  {#snippet actions()}
    <div class="d-flex justify-content-end gap-2">
      <BaseButton class="btn btn-secondary" text={t("common.cancel")} onClick={cancelDelete} disabled={deleting} />
      <BaseButton class="btn btn-danger" icon="trash" text={deleting ? t("common.deleting") : t("common.confirm-delete")} onClick={handleDelete} disabled={deleting} />
    </div>
  {/snippet}

  <BaseModal bind:isOpen={showDeleteModal} size="md" {header} {body} {actions} />
{/if}
