<script>
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import BaseSelect from "$lib/components/base/BaseSelectNew.svelte";
  import BasePagination from "$lib/components/base/BasePagination.svelte";
  import BaseBadgeStatus from "$lib/components/base/BaseBadgeStatus.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import ObjectDetail from "$lib/components/objects/ObjectDetail.svelte";
  import ObjectCard from "$lib/components/objects/ObjectCard.svelte";
  import ObjectsTable from "$lib/components/objects/ObjectsTable.svelte";
  import { formatDate } from "$lib/utils/dates.js";

  let { institution, objects, ontologyFields, params = $bindable() } = $props();

  const { t, translationState } = getTranslationStore();

  let viewAs = $state("grid");
  let selectedObjects = $state([]);

  $inspect(selectedObjects);

  const viewAsOptions = $derived([
    { value: "grid", label: t("common.grid-view", { fallback: "Grid" }) },
    { value: "table", label: t("common.table-view", { fallback: "Table" }) },
  ]);

  const ontologyFieldsList = $derived.by(() => {
    return [
      {
        value: "all",
        label: t("common.all", { fallback: "All" }),
      },
      ...ontologyFields.result.map((field) => ({
        value: field.id,
        label: field.name.content,
      })),
    ];
  });

  const orderBy = $derived([
    // { value: "name", label: t("common.name", { fallback: "Name" }) },
    {
      value: "created_at",
      label: t("common.created-at", { fallback: "Created At" }),
    },
    {
      value: "updated_at",
      label: t("common.updated-at", { fallback: "Updated At" }),
    },
  ]);

  const statuses = $derived([
    {
      value: "all",
      label: t("common.all", { fallback: "All" }),
    },
    {
      value: "in progress",
      label: t("common.in-progress", { fallback: "In progress" }),
    },
    {
      value: "completed",
      label: t("common.completed", { fallback: "Completed" }),
    },
  ]);
  // Function to get object title from mapped ontology field
  function getObjectTitle(object) {
    if (object.objectsOntologyFields) {
      const titleField = object.objectsOntologyFields.find(
        (field) =>
          field.ontologyField?.name?.content?.toLowerCase() === "object id"
      );
      if (titleField && titleField.value) {
        return titleField.value;
      }
    }
    // Fallback to the object's ID if no mapped field is found or value is empty
    return object.id || "Unknown ID";
  }

  // Function to get object type (designation) from mapped ontology field
  function getObjectType(object) {
    if (object.objectsOntologyFields) {
      const designationField = object.objectsOntologyFields.find(
        (field) =>
          field.ontologyField?.name?.content?.toLowerCase() === "designation"
      );
      // Return the value if found, otherwise null
      return designationField?.value || null;
    }
    return null; // Return null if objectsOntologyFields doesn't exist
  }

  // Placeholder function to get object status
  function getObjectStatus(object) {
    // Use the status field directly from the object data
    return object.status || "unknown status";
  }

  // Function to find image URL from the object's linked assets
  function getObjectImageUrl(object) {
    if (!object.objectsAssets || object.objectsAssets.length === 0) {
      return null; // No linked assets
    }

    const firstObjectAsset = object.objectsAssets[0];
    if (!firstObjectAsset || !firstObjectAsset.asset) {
      return null; // Malformed object asset link
    }

    const asset = firstObjectAsset.asset;
    let imageUrl = null;

    if (asset.formats) {
      try {
        // Parse formats if it's a string (safer check)
        const formats =
          typeof asset.formats === "string"
            ? JSON.parse(asset.formats)
            : asset.formats;

        // Prefer thumbnail or small format for the card view
        imageUrl = formats.thumbnail || formats.sm || formats.original || null;
      } catch (e) {
        console.error("Error parsing asset formats:", e);
        // Fallback to path if formats parsing fails
        imageUrl = asset.path || null;
      }
    } else {
      // Fallback to path if formats field doesn't exist
      imageUrl = asset.path || null;
    }

    // Prefix with media protocol if a URL/path was found
    return imageUrl ? `media://${imageUrl}` : null;
  }
</script>

<div class="w-100">
  <div class="row align-items-center mb-3">
    <div class="col-4">
      <BaseInput
        icon="search"
        placeholder={t("common.search", { fallback: "Search" })}
        size="sm"
        bind:value={params.oSearch}
        optionsList={ontologyFieldsList}
        bind:optionsValue={params.oSearchField}
      />
    </div>
    <div class="col-8 d-flex justify-content-end gap-3 align-items-center">
      <!-- <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.order-by", { fallback: "Order by" })}
        </div>
        <BaseSelect items={orderBy} bind:value={params.oOrderBy} size="sm"
        ></BaseSelect>
      </div> -->

      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.status", { fallback: "Status" })}
        </div>
        <BaseSelect items={statuses} bind:value={params.oStatus} size="sm"
        ></BaseSelect>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="col-auto fs-7">
          {t("common.view-as", { fallback: "View as" })}
        </div>
        <BaseSelect items={viewAsOptions} bind:value={viewAs} size="sm"
        ></BaseSelect>
      </div>
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{institution.project_id}/objects/add?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("common.add-object", { fallback: "Add Object" })}</a
      >
      <a
        class="btn btn-primary btn-sm"
        href="/projects/{institution.project_id}/import?institution_id={institution.id}"
        ><i class="bi bi-plus-lg"></i>
        {t("common.import-data", { fallback: "Import Data" })}</a
      >
    </div>
  </div>
  {#if objects.items.length > 0}
    {#if viewAs === "list"}
      <ObjectDetail
        bind:object={objects.selectedObject}
        institutionId={institution.id}
      />
    {/if}
    {#if viewAs === "grid"}
      <div class="row">
        {#each objects.items as object (object.id)}
          <div class="col-4">
            <ObjectCard {object} />
          </div>
        {/each}
      </div>
    {:else if viewAs === "table"}
      <ObjectsTable
        objects={objects.items}
        columns={[
          {
            value: "created_at",
            label: t("common.created-at", { fallback: "Created At" }),
            sortable: true,
            render: (value) =>
              formatDate(+value, translationState.currentLocale, true),
          },
          {
            value: "updated_at",
            label: t("common.updated-at", { fallback: "Updated At" }),
            sortable: true,
            render: (value) =>
              formatDate(+value, translationState.currentLocale, true),
          },
          {
            value: "status",
            label: t("common.status", { fallback: "Status" }),
            sortable: true,
            render: (value) => ({
              component: BaseBadgeStatus,
              props: { status: value },
            }),
          },
        ]}
        bind:orderBy={params.oOrderBy}
        bind:direction={params.oDirection}
        bind:selected={selectedObjects}
      />
    {/if}
  {:else if objects.items.length === 0}
    <div class="text-center text-black-50 fs-4 fst-italic mt-4">
      {t("common.no-objects-found", { fallback: "No objects found." })}
    </div>
  {/if}

  {#if objects.totalCount > params.pageSize}
    <div class="row">
      <div class="col-auto">
        <BasePagination
          bind:page={params.oPage}
          pageSize={params.pageSize}
          count={objects.totalCount}
          size="sm"
        />
      </div>
    </div>
  {/if}
</div>
<!-- 

  {#if displayMode === "grid"}
    <div
      class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4"
    >
      {#each objectsList as object (object.id)}
        <div class="col">
          <LinkShallow href="{page.url.pathname}/objects/{object.id}"
            >vaiiiii</LinkShallow
          >
 
          <div class="card h-100">
            <BaseImage
              src={getObjectImageUrl(object)}
              alt={getObjectTitle(object)}
              ratio="1/1"
              objectFit="cover"
              class="card-img-top"
            />
            <div class="card-body">
              <h6 class="card-title text-truncate">
                {getObjectTitle(object)}
              </h6>
              {#if getObjectType(object)}
                <p class="card-text small text-muted mb-1">
                  {getObjectType(object)}
                </p>
              {/if}
           
              {#if getObjectStatus(object).toLowerCase() === "completed"}
                <span class="badge bg-success">Completed</span>
              {:else if getObjectStatus(object).toLowerCase() === "in progress"}
                <span class="badge bg-warning text-dark">in progress</span>
              {:else}
                <span class="badge bg-secondary">{getObjectStatus(object)}</span
                >
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}

    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th scope="col" style="width: 80px;"
              ><button class="btn btn-sm btn-dark">Preview</button></th
            >
            <th scope="col"
              ><button class="btn btn-sm btn-dark">Object ID</button></th
            >
            <th scope="col"
              ><button class="btn btn-sm btn-dark">Designation</button></th
            >
            <th scope="col"
              ><button class="btn btn-sm btn-dark">Status</button></th
            >
          </tr>
        </thead>
        <tbody>
          {#if filteredObjects.length === 0}
            <tr>
              <td colspan="4" class="text-center text-muted py-4"
                >No objects found.</td
              >
            </tr>
          {:else}
            {#each filteredObjects as object (object.id)}
              <tr
                role="button"
                tabindex="0"
                style="cursor: pointer;"
                onclick={() => showObjectDetail(object.id)}
                onkeydown={(event) => handleObjectKeyPress(event, object.id)}
              >
                <td>
                  <BaseImage
                    src={getObjectImageUrl(object)}
                    alt={getObjectTitle(object)}
                    width="60"
                    height="60"
                    objectFit="cover"
                    ratio="1/1"
                  />
                </td>
                <td>{getObjectTitle(object)}</td>
                <td>{getObjectType(object) || "-"}</td>
                <td>
                  {#if getObjectStatus(object).toLowerCase() === "completed"}
                    <span class="badge bg-success">Completed</span>
                  {:else if getObjectStatus(object).toLowerCase() === "in progress"}
                    <span class="badge bg-warning text-dark">in progress</span>
                  {:else}
                    <span class="badge bg-secondary"
                      >{getObjectStatus(object)}</span
                    >
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  {/if}

  {#if filteredObjects.length === 0 && displayMode === "grid"}
    <div class="alert alert-info mt-4">
      No objects found.
    
    </div>
  {/if}
</div> -->
