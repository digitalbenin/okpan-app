<script>
  import { page } from "$app/state";
  import { getObjects } from "$lib/stores/ObjectsUtils.js";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseInput from "$lib/components/base/BaseInput.svelte";
  import ChipObject from "./ChipObject.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getAssetImageUrl } from "$lib/utils/media.js";
  import { resource } from "runed";

  let {
    asset,
    suggestions = [],
    mappedObject = $bindable(null),
    disabled = false,
  } = $props();
  const { t } = getTranslationStore();

  let open = $state(false);
  let search = $state();

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
    // fieldMatched = page.data.ontologyFields.result
    //   .filter((f) => f.id === value)
    //   .map((f) => ({
    //     name: f.name.content,
    //     id: f.id,
    //     description: f.description.content,
    //     suggestion: suggestions.some((ss) => ss.ontologyFieldId === f.id),
    //   }))[0];
    // open = false;
  }
</script>

<BaseAlertDialog
  bind:open
  buttonProps={{
    class: "btn btn-outline-secondary btn-sm",
    disabled: disabled,
  }}
  size="lg"
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
              bind:mappedObject
            />
          {/each}
        </div>
      {/if}
      {#if searchResults.current}
        <div>
          <h6 class="fw-bold">
            {t("import.other-results", { fallback: "Other Results" })}
          </h6>
          {#each searchResults.current as result}
            <ChipObject
              assetId={asset.id}
              object={result}
              suggested={false}
              bind:mappedObject
            />
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <!-- {#snippet footer()}
    <button class="btn btn-success" onclick={updateMatch}>
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet} -->
</BaseAlertDialog>
