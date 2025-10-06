<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseImage from "$lib/components/base/BaseImage.svelte";
  import BaseButton from "$lib/components/base/BaseButton.svelte";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import AutoForm from "$lib/components/form/AutoForm.svelte";
  import { createForm } from "@tanstack/svelte-form";
  import {
    getValidator,
    createFieldValidator,
    getFormConfig,
  } from "$lib/stores/formValidationUtils.js";
  import {
    updateDatasource,
    deleteDatasource,
    getObjectsByDatasource,
  } from "$lib/stores/DatasourcesUtils.js";
  import { addImageProtocolPrefix } from "$lib/utils/images.js";
  import { goto } from "$app/navigation";
  import { getObjectIdentifier } from "$lib/utils/objects.js";

  const { data } = $props();
  const { t } = getTranslationStore();

  // Basic route params and data
  const projectId = $derived(data.projectId);
  const institutionId = $derived(data.institutionId);
  const datasourceId = $derived(data.datasourceId);
  // Support loader returning an array; normalize to single datasource object
  const datasource = $state(
    Array.isArray(data.datasource)
      ? data.datasource[0] || {}
      : data.datasource || {},
  );
  const languages = $derived(data.languages || []);

  // Determine default language
  const defaultLanguage = $derived(
    languages?.find((l) => l.is_default) || languages?.[0] || null,
  );

  // Pagination state for imported objects
  let page = $state(1); // BasePagination uses 1-index pages elsewhere
  let pageSize = $state(10);
  let objects = $state(data.objects?.items || []);
  let totalCount = $state(data.objects?.totalCount || objects?.length || 0);
  let isLoadingObjects = $state(false);

  // Compute total pages and use it to hide pagination for single-page lists
  const totalPages = $derived.by(() =>
    Math.ceil((totalCount || 0) / Math.max(1, pageSize || 10)),
  );

  async function loadObjects() {
    isLoadingObjects = true;
    try {
      const { items, totalCount: tc } = await getObjectsByDatasource({
        datasourceId,
        projectId,
        institutionId,
        page: Math.max(0, (page || 1) - 1),
        pageSize,
      });
      objects = items || [];
      totalCount = tc || 0;
    } catch (e) {
      objects = [];
      totalCount = 0;
    } finally {
      isLoadingObjects = false;
    }
  }

  // Load objects when user interacts with pagination (no $effect)
  let _prevPage = $state(page);

  // Helper: derive title and image from object record
  function getObjectTitle(obj) {
    // Show only the primary ontology identifier; no fallback to object.id
    try {
      const primary = obj?.objectsOntologyFields?.find((f) => f?.primary);
      return primary?.value ?? "";
    } catch (_) {
      return "";
    }
  }

  function getObjectImageUrl(obj) {
    const asset = obj?.objectsAssets?.[0]?.asset;
    if (!asset) return null;
    try {
      const formats =
        typeof asset.formats === "string"
          ? JSON.parse(asset.formats)
          : asset.formats;
      const src =
        formats?.sm ||
        formats?.md ||
        formats?.lg ||
        formats?.original ||
        asset.path;
      return addImageProtocolPrefix(src || null);
    } catch (_) {
      return addImageProtocolPrefix(asset.path || null);
    }
  }

  // Form: edit translatable strings only
  const translatableFields = ["name", "method", "notes"]; // strings in datasource
  const validator = getValidator("datasources", "update");
  const translationsValidator = getValidator("translations", "create");

  // Gather initial values for form
  const initialValues = $derived.by(() => {
    const values = {};
    // Main language content
    values.name = datasource?.name?.content || "";
    values.method = datasource?.method?.content || "";
    values.notes = datasource?.notes?.content || "";
    // Simple direct fields (not all editable here, but keep date)
    values.date = datasource?.date || new Date().toISOString();
    // Hidden/static fields
    values.languageId = defaultLanguage?.id || "";
    values.institutionId = String(institutionId || "");
    values.templateId = null;
    return values;
  });

  // Collect translation values for secondary languages
  function collectTranslations(values) {
    const secondary = (languages || []).filter((l) => !l.is_default);
    const collect = (field) =>
      secondary
        .map((lang) => {
          const key = `translations_${lang.id}_${field}`;
          const v = values?.[key];
          if (!v || !String(v).trim()) return null;
          return { languageId: lang.id, content: String(v).trim() };
        })
        .filter(Boolean);
    return {
      nameTranslations: collect("name"),
      methodTranslations: collect("method"),
      notesTranslations: collect("notes"),
    };
  }

  let allValidationErrors = $state([]);
  function setAllValidationErrors(errors) {
    allValidationErrors = errors || [];
  }

  const form = createForm(() =>
    getFormConfig("datasources", "update", {
      defaultValues: initialValues,
      onSubmit: async ({ value }) => {
        // Build payload for update (strings only + date)
        const tx = collectTranslations(value);
        const payload = {
          name: value.name,
          method: value.method,
          notes: value.notes,
          date: value.date,
          ...tx,
        };
        const { error } = await updateDatasource(datasourceId, payload);
        if (!error) {
          // Reload datasource page to reflect changes
          // Keeping user on the same page
        }
      },
    }),
  );

  // Delete handler
  let deleting = $state(false);
  let showDeleteModal = $state(false);
  function openDeleteModal() {
    showDeleteModal = true;
  }

  function cancelDelete() {
    showDeleteModal = false;
  }

  async function handleDelete() {
    if (!datasourceId) {
      showDeleteModal = false;
      return;
    }
    deleting = true;
    try {
      const res = await deleteDatasource(datasourceId);
      if (!res?.error) {
        // Go back to institution datasources list
        await goto(`/projects/${projectId}/institutions/${institutionId}`);
      }
    } finally {
      deleting = false;
      showDeleteModal = false;
    }
  }
</script>

<div class="container-fluid">
  <div class="row my-3">
    <div class="col-12">
      <h1 class="h3 mb-0">
        {datasource?.name?.content ||
          t("common.unnamed", { fallback: "Unnamed" })}
      </h1>
    </div>
  </div>

  <div class="row g-4">
    <!-- Left column: edit form -->
    <div class="col-12 col-lg-8">
      <div class="card border-0">
        <div class="card-body">
          <AutoForm
            {form}
            {validator}
            {createFieldValidator}
            {languages}
            entity="datasources"
            operation="update"
            {translatableFields}
            {translationsValidator}
            hiddenStaticValues={{
              institutionId: String(institutionId || ""),
              languageId: defaultLanguage?.id || "",
              datasourceId: String(datasourceId || ""),
              templateId: null,
            }}
            fieldOrder={["date"]}
            uiSchema={{
              id: { hidden: true },
              datasourceId: { hidden: true },
              name: {
                label: t("common.name", { fallback: "Name" }),
                type: "text",
                placeholder: t("common.name", { fallback: "Name" }),
              },
              method: {
                label: t("import.method", { fallback: "Method" }),
                type: "textarea",
                placeholder: t("import.method", {
                  fallback: "Describe method",
                }),
              },
              notes: {
                label: t("common.notes", { fallback: "Notes" }),
                type: "textarea",
                placeholder: t("common.notes", { fallback: "Notes" }),
              },
              date: {
                label: t("common.date", { fallback: "Date" }),
                type: "date",
              },
              institutionId: { hidden: true },
              languageId: { hidden: true },
              templateId: { hidden: true },
            }}
            structuredErrors={allValidationErrors}
            setStructuredErrors={setAllValidationErrors}
          />
        </div>
      </div>
    </div>

    <!-- Right column: imported objects list -->
    <div class="col-12 col-lg-4">
      <div class="d-flex align-items-center justify-content-between mb-2">
        <h2 class="h5 mb-0">
          {t("common.imported-objects", { fallback: "Imported objects" })} ({totalCount})
        </h2>
      </div>

      <div class="list-group rounded-3">
        {#if isLoadingObjects}
          <div class="text-center py-4 text-muted">
            {t("common.loading", { fallback: "Loading..." })}
          </div>
        {:else if objects.length === 0}
          <div class="text-center py-4 text-muted">
            {t("common.no-results", { fallback: "No results" })}
          </div>
        {:else}
          {#each objects as obj}
            <div class="list-group-item list-group-item-action py-2">
              <div class="d-flex align-items-center gap-3">
                <BaseImage
                  src={getObjectImageUrl(obj)}
                  alt={getObjectIdentifier(obj) || "Object"}
                  width={60}
                  height={60}
                  class="rounded border"
                />
                <div class="flex-grow-1 text-truncate">
                  <div class="fw-semibold text-truncate">
                    {getObjectIdentifier(obj)}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>

      {#if totalPages > 1}
        <div
          class="d-flex justify-content-end mt-3"
          onclick={() => {
            if (page !== _prevPage) {
              _prevPage = page;
              loadObjects();
            }
          }}
        >
          <BasePagination bind:page {pageSize} count={totalCount} size="sm" />
        </div>
      {/if}
    </div>
  </div>

  <!-- Sticky bottom action bar -->
  <div
    class="sticky-bottom-bar position-sticky bottom-0 bg-white border-top border-light-subtle mt-4 z-1"
  >
    <div class="container-fluid py-2">
      <div class="d-flex justify-content-between align-items-center">
        <div class="text-muted">
          {t("common.changes-notice", {
            fallback: "Changes apply to datasource text only.",
          })}
        </div>
        <div class="d-flex gap-2">
          <BaseButton
            class="btn btn-outline-danger"
            text={t("common.delete", { fallback: "Delete" })}
            disabled={deleting}
            onClick={openDeleteModal}
          />
          <BaseButton
            class="btn btn-primary"
            text={t("common.save", { fallback: "Save" })}
            onClick={() => form.handleSubmit()}
          />
        </div>
      </div>
    </div>
  </div>

  {#if showDeleteModal}
    {#snippet header()}
      {t("common.confirm-delete", { fallback: "Confirm Deletion" })}
    {/snippet}

    {#snippet body()}
      <p>
        {t("common.confirm-delete-datasource", {
          fallback:
            "Are you sure you want to delete this datasource? This will also remove all linked ontology fields from objects.",
        })}
      </p>
      <p class="text-danger">
        {t("common.operation-irreversible", {
          fallback: "This operation is irreversible.",
        })}
      </p>
    {/snippet}

    {#snippet actions()}
      <div class="d-flex justify-content-end gap-2">
        <BaseButton
          class="btn btn-secondary"
          text={t("common.cancel", { fallback: "Cancel" })}
          onClick={cancelDelete}
          disabled={deleting}
        />
        <BaseButton
          class="btn btn-danger"
          icon="trash"
          text={deleting
            ? t("common.deleting", { fallback: "Deleting..." })
            : t("common.confirm-delete", { fallback: "Confirm delete" })}
          onClick={handleDelete}
          disabled={deleting}
        />
      </div>
    {/snippet}

    <BaseModal
      bind:isOpen={showDeleteModal}
      size="md"
      {header}
      {body}
      {actions}
    />
  {/if}
</div>
