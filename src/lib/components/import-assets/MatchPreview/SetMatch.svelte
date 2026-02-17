<script>
  import { page } from "$app/state";
  import { getObjects } from "$lib/stores/ObjectsUtils.js";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import ChipObject from "./ChipObject.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getAssetImageUrl } from "$lib/utils/media.js";
  import { resource } from "runed";

  let {
    asset,
    suggestions = [],
    mappedObjects = $bindable([]),
    disabled = false,
  } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();

  let open = $state(false);
  let search = $state();
  let tempMappedObjects = $state([]);

  $effect(() => {
    if (open) {
      tempMappedObjects = [...mappedObjects];
    }
  });

  const searchResults = resource(
    () => search,
    async (search, prevSearch, { data, refetching, onCleanup, signal }) => {
      const objectsData = await getObjects({
        search,
        projectId: page.data.project.id,
      });
      console.log(objectsData, "objectsData");
      return objectsData.items;
    },
    {
      debounce: 300,
      lazy: true,
    }
  );

  // let value = $derived(fieldMatched ? fieldMatched.id : null);
  // const items = $derived.by(() => {
  //   return page.data.ontologyFields.result
  //     .map((s) => ({
  //       value: s.id,
  //       label: s.name.content,
  //       suggested: suggestions.some((ss) => ss.ontologyFieldId === s.id),
  //     }))
  //     .sort((a, b) => {
  //       if (a.suggested && !b.suggested) return -1;
  //       if (!a.suggested && b.suggested) return 1;
  //       return 0;
  //     });
  // });

  function updateMatch() {
    // Determine objects to remove (present in mappedObjects but not in tempMappedObjects)
    const toRemove = mappedObjects.filter(
      (m) => !tempMappedObjects.some((t) => t.id === m.id)
    );
    // Determine objects to add (present in tempMappedObjects but not in mappedObjects)
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
    class: "btn btn-outline-secondary btn-sm",
    disabled: disabled,
  }}
  size="xl"
>
  {#snippet title()}
    {t("import.edit-link", { fallback: "Edit linked asset" })}
  {/snippet}
  {#snippet trigger()}
    <i class="bi bi-pencil"></i>
    {t("import.edit-link", {
      fallback: "Edit linked asset",
    })}
  {/snippet}
  {#snippet description()}
    {t("import.match-description", {
      fallback: "Change the linked asset for",
    })} <span class="fw-bold">{asset.filename}</span>
    {#if tempMappedObjects.length > 0}
      <div class="mt-1 small text-primary">
        {tempMappedObjects.length} {t("common.selected", { fallback: "selected" })}
      </div>
    {/if}
  {/snippet}

  <div class="row mt-3">
    <div class="col-3">
      <div
        class="w-100 position-relative overflow-hidden aspect-ratio-1x1 bg-light p-2 rounded"
      >
        <img
          src={getAssetImageUrl(asset, 'md')}
          alt={asset.filename}
          class="object-fit-contain w-100 h-100"
        />
      </div>
    </div>
    <div class="col-9">
      <div class="mb-3">
        <BaseInput
          icon="search"
          placeholder={t("common.search", { fallback: "Search" })}
          size="sm"
          bind:value={search}
        />
      </div>
      {#if suggestions.length}
        <div>
          <h6 class="fw-bold">
            {t("import.suggestions", { fallback: "Suggestions" })}
          </h6>
          {#each suggestions as suggestion}
            <ChipObject
              assetId={asset.id}
              object={suggestion.object}
              suggested={true}
              bind:mappedObjects={tempMappedObjects}
            />
          {/each}
        </div>
      {/if}
      {#if searchResults.current}
        <div class="mt-4">
          <h6 class="fw-bold">
            {t("import.other-results", { fallback: "Other Results" })}
          </h6>
          {#each searchResults.current as result}
            <ChipObject
              assetId={asset.id}
              object={result}
              suggested={false}
              bind:mappedObjects={tempMappedObjects}
            />
          {/each}
        </div>
      {/if}
    </div>
  </div>
  {#snippet footer()}
    <button class="btn btn-secondary me-2" onclick={() => (open = false)}>
      {t("common.cancel", { fallback: "Cancel" })}
    </button>
    <button class="btn btn-success" onclick={updateMatch}>
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseAlertDialog>
