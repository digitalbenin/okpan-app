<script>
  import { page } from "$app/state";
  import { IconPencil, IconSearch, IconLink, IconInfoCircle, IconCircleMinus } from "@tabler/icons-svelte";
  import { getObjects } from "$lib/api/ObjectsApi.js";
  import { getObjectIdentifier } from "$lib/api/ObjectsApi.js";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getAssetImageUrl } from "$lib/utils/media.js";
  import { resource, watch } from "runed";

  let {
    asset,
    suggestions = [],
    mappedObjects = $bindable([]),
    disabled = false,
  } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();

  let open = $state(false);
  let searchTerm = $state("");
  let tempMappedObjects = $state([]);

  watch(() => open, (isOpen) => {
    if (isOpen) {
      tempMappedObjects = [...mappedObjects];
    }
  });

  const searchResults = resource(
    () => searchTerm,
    async (term) => {
      if (!term?.trim()) return null;
      const objectsData = await getObjects({
        search: term,
        projectId: page.data.project.id,
      });
      return objectsData.items;
    },
    { debounce: 300, lazy: true }
  );

  const mergedItems = $derived.by(() => {
    const seen = new Set();
    const items = [];
    // Suggestions first, deduplicated
    for (const s of suggestions) {
      const obj = s.object;
      if (!seen.has(obj.id)) {
        seen.add(obj.id);
        items.push({ object: obj, suggested: true });
      }
    }
    // Search results after, deduplicated
    if (searchResults.current) {
      for (const obj of searchResults.current) {
        if (!seen.has(obj.id)) {
          seen.add(obj.id);
          items.push({ object: obj, suggested: false });
        }
      }
    }
    return items;
  });

  const isLinked = (obj) => tempMappedObjects.some((o) => o.id === obj.id);

  let expandedIds = $state(new Set());

  function toggleExpanded(objectId) {
    const next = new Set(expandedIds);
    if (next.has(objectId)) {
      next.delete(objectId);
    } else {
      next.add(objectId);
    }
    expandedIds = next;
  }

  function toggleObject(obj) {
    if (isLinked(obj)) {
      tempMappedObjects = tempMappedObjects.filter((o) => o.id !== obj.id);
    } else {
      tempMappedObjects = [...tempMappedObjects, obj];
    }
  }

  function updateMatch() {
    const toRemove = mappedObjects.filter(
      (m) => !tempMappedObjects.some((t) => t.id === m.id)
    );
    const toAdd = tempMappedObjects.filter(
      (t) => !mappedObjects.some((m) => m.id === t.id)
    );

    toRemove.forEach((obj) => wizard.removeMappingEntry(obj, asset.id));
    toAdd.forEach((obj) => wizard.addMappingEntry(obj, asset.id));

    mappedObjects = [...tempMappedObjects];
    open = false;
  }
</script>

<BaseAlertDialog
  bind:open
  buttonProps={{
    class: "btn btn-secondary btn-sm",
    disabled: disabled,
  }}
  size="xl"
>
  {#snippet title()}
    {t("import-assets.edit-link-title", { fallback: "Edit linked asset" })}
  {/snippet}
  {#snippet trigger()}
    <IconPencil size={14} />
    {t("import-assets.edit-link", {
      fallback: "Edit linked asset",
    })}
  {/snippet}
  {#snippet description()}
    <span class="d-block mb-3">
      {t("import-assets.change-linked-object", {
        fallback: "Change the linked object for",
      })} <span class="fw-semibold">{asset.filename}</span>
    </span>
  {/snippet}

  <div class="d-flex gap-4 align-items-start">
    <!-- Asset image preview -->
    <div class="flex-shrink-0 overflow-hidden rounded-3" style="width: 280px; aspect-ratio: 1/1;">
      <img
        src={getAssetImageUrl(asset, 'md')}
        alt={asset.filename}
        class="object-fit-cover w-100 h-100"
      />
    </div>

    <!-- Search + object list -->
    <div class="flex-grow-1 d-flex flex-column gap-3 min-w-0">
      <!-- Search bar -->
      <div class="input-group rounded-3 overflow-hidden border" style="border-color: #eaebe7;">
        <input
          type="text"
          class="form-control border-0"
          placeholder={t("import-assets.search-object", { fallback: "Search object" })}
          bind:value={searchTerm}
        />
        <span class="input-group-text bg-white border-0">
          <IconSearch size={16} class="text-body-secondary" />
        </span>
      </div>

      <!-- Object list -->
      <div class="d-flex flex-column gap-2" style="max-height: 350px; overflow-y: auto;">
        {#if mergedItems.length}
          {#each mergedItems as { object, suggested }}
            {@const linked = isLinked(object)}
            {@const primaryId = getObjectIdentifier(object)}
            {@const isExpanded = expandedIds.has(object.id)}
            <div class="bg-white border rounded-3 p-3 d-flex flex-column gap-3" style="border-color: #d5d6d0;">
              <div class="d-flex flex-column gap-2">
                <p class="mb-0 text-body-secondary text-uppercase fw-normal" style="font-size: 12px; letter-spacing: 0.24px; line-height: 1.2;">
                  {t("import-assets.object-name-label", { fallback: "Object name" })}
                </p>
                <div class="d-flex align-items-center justify-content-between">
                  <div class="d-flex align-items-center gap-2">
                    <span class="fw-semibold" style="font-size: 20px; line-height: 1.5; color: #000;">{primaryId}</span>
                    {#if suggested}
                      <span class="badge fw-normal rounded-1 px-2 py-1" style="background: #008060; color: #fff; font-size: 12px;">
                        {t("import.suggested", { fallback: "Suggested" })}
                      </span>
                    {/if}
                  </div>
                  <div class="d-flex align-items-center gap-2">
                    <button
                      class="btn btn-sm d-flex align-items-center gap-1"
                      class:btn-primary={linked}
                      class:btn-secondary={!linked}
                      style="font-size: 14px; padding: 5px 13px; border-radius: 6.4px;"
                      onclick={() => toggleObject(object)}
                    >
                      <IconLink size={14} />
                      {linked
                        ? t("import-assets.linked", { fallback: "Linked" })
                        : t("import-assets.add", { fallback: "Add" })}
                    </button>
                    <button
                      class="btn btn-sm btn-secondary d-flex align-items-center justify-content-center p-0"
                      style="width: 33px; height: 33px; border-radius: 6.4px;"
                      onclick={() => toggleExpanded(object.id)}
                      aria-label={isExpanded ? t("common.collapse", { fallback: "Collapse" }) : t("common.more-info", { fallback: "More info" })}
                    >
                      {#if isExpanded}
                        <IconCircleMinus size={14} />
                      {:else}
                        <IconInfoCircle size={14} />
                      {/if}
                    </button>
                  </div>
                </div>
              </div>

              {#if isExpanded}
                <div class="d-flex flex-column gap-4">
                  <!-- Connections -->
                  {#if object.objectsResearchFields?.length}
                    <div class="d-flex flex-column gap-2">
                      <p class="mb-0 text-body-secondary text-uppercase fw-normal" style="font-size: 12px; letter-spacing: 0.24px; line-height: 1.2;">
                        {t("common.connections", { fallback: "Connections" })}
                      </p>
                      <div class="d-flex flex-column" style="font-size: 16px; line-height: 1.5;">
                        {#each object.objectsResearchFields as field}
                          <div>
                            <span class="fw-semibold">{field.researchField?.name?.content || "Field"}:</span> <span>{field.value || field.vocabulary?.option?.content || "Unknown"}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Institutional data -->
                  {#if object.objectsOntologyFields?.length}
                    <div class="d-flex flex-column gap-2">
                      <p class="mb-0 text-body-secondary text-uppercase fw-normal" style="font-size: 12px; letter-spacing: 0.24px; line-height: 1.2;">
                        {t("common.institution-data", { fallback: "Institutional data" })}
                      </p>
                      <div class="d-flex flex-column" style="font-size: 16px; line-height: 1.5;">
                        {#each object.objectsOntologyFields as field}
                          <div>
                            <span class="fw-semibold">{field.ontologyField?.name?.content || "Field"}:</span> <span>{field.value}</span>
                          </div>
                        {/each}
                      </div>
                    </div>
                  {/if}

                  <!-- Asset thumbnails -->
                  {#if object.objectsAssets?.length}
                    <div class="d-flex flex-column gap-2">
                      <p class="mb-0 text-body-secondary text-uppercase fw-normal" style="font-size: 12px; letter-spacing: 0.24px; line-height: 1.2;">
                        {t("import-assets.media", { fallback: "Media" })}
                      </p>
                      <div class="d-flex gap-2">
                        {#each object.objectsAssets as link}
                          {@const thumbUrl = link.asset ? getAssetImageUrl(link.asset, 'sm') : null}
                          {#if thumbUrl}
                            <div class="overflow-hidden rounded-2" style="width: 120px; aspect-ratio: 1/1;">
                              <img src={thumbUrl} alt={link.asset.filename || ''} class="object-fit-cover w-100 h-100" />
                            </div>
                          {/if}
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        {:else if searchTerm.trim()}
          <p class="text-body-secondary fst-italic text-center py-4">
            {t("import-assets.no-objects-found", { fallback: "No objects found." })}
          </p>
        {/if}
      </div>
    </div>
  </div>

  {#snippet footer()}
    <button class="btn btn-success" onclick={updateMatch}>
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseAlertDialog>
