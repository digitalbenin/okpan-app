<script>
  import { page } from "$app/state";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import BaseRadioGroup from "$lib/components/base/BaseRadioGroup.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { addImageProtocolPrefix } from "$lib/utils/images.js";

  let {
    asset,
    suggestions = [],
    mappedObject = $bindable(),
    disabled = false,
  } = $props();
  const { t } = getTranslationStore();

  let open = $state(false);
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
      <div class="w-100 position-relative overflow-hidden aspect-ratio-1x1">
        <img
          src={addImageProtocolPrefix(asset.formats.md)}
          alt={asset.filename}
          class="object-fit-contain w-100 h-100"
        />
      </div>
    </div>
    <div class="col-9">
      <div>search</div>
      {#if suggestions.length}
        <div>
          {#each suggestions as suggestion}
            <div>{suggestion.object.id}</div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  {#snippet footer()}
    <button class="btn btn-success" onclick={updateMatch}>
      {t("common.confirm", { fallback: "Confirm" })}
    </button>
  {/snippet}
</BaseAlertDialog>
