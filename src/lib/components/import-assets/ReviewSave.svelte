<script>
  //   import ItemsPreview from "./ItemsPreview.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import { bulkLinkAssetsToObjects } from "$lib/stores/AssetsUtils.js";
  import { goto } from "$app/navigation";
  import TableMatchPreview from "./TableMatchPreview.svelte";
  import Table from "../base/Table/Table.svelte";

  // import { parseData } from "$lib/utils/import.js";

  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();

  const saveFetcher = createFetcher(bulkLinkAssetsToObjects);

  let open = $state(false);
  const handleSave = async function () {
    try {
      const saveParams = $state.snapshot(wizard.mapping);

      const response = await saveFetcher.fetch(
        saveParams
          .filter((m) => m.object_ids && m.object_ids.length > 0)
          .map((m) => {
            return {
              asset_id: m.asset_id,
              object_ids: m.object_ids,
            };
          })
      );
      open = true;
      console.log("Assets linked:", response);
    } catch (error) {
      console.error("Error linking assets:", error);
      // Handle error appropriately, e.g., show a notification
    }
  };

  wizard.save = handleSave;

  //   const finalData = $derived(
  //     parseData(wizard.data, wizard.mapping, wizard.file.format)
  //   );
  $inspect(wizard);
  const assetsLinked = $derived.by(() => {
    return wizard.mapping.filter((m) => m.object_ids && m.object_ids.length > 0)
      .length;
  });

  function closeAndHome() {
    open = false;
    goto("/projects/" + wizard.projectId);
  }
</script>

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h3>
        {t("import.review-start", {
          fallback: "Review your data and save it to the archive.",
        })}
      </h3>
      <p class="w-75">
        {t("import.review-description", {
          fallback:
            "In this step, you’ll see a summary of your data and can make final adjustments before saving it to the archive. This is your chance to ensure everything is correct and ready for archiving.",
        })}
      </p>
    </div>
  </div>
  <div class="row mb-2">
    <div class="col-12">
      <div class="alert alert-primary" role="alert">
        <span class="fw-bold">{assetsLinked}</span>
        {t("import.assets-will-be-linked", {
          fallback: "asset(s) will be linked",
        })}
      </div>
      <!-- 
      <div>
        {wizard.mapping.length}
        {t("import.fields-will-be-imported", {
          fallback: "fields will be imported",
        })}
        {t("common.and", {
          fallback: "and",
        })}
        {wizard.mapping.filter((m) => m.mappedField).length}
        {t("import.fields-are-mapped", {
          fallback: "fields are mapped",
        })}.
      </div>
      <div>
        {t("import.primary-field-set-to", {
          fallback: "Object identifier field is set to",
        })}
        <span class="fw-bold"
          >{wizard.mapping.find((m) => m.primary).headerField}</span
        >
      </div> -->
      <!-- <button class="btn btn-success btn-lg mt-3" onclick={handleSave}>
        {t("common.save-data", {
          fallback: "Save Data",
        })}
      </button> -->
      {#if saveFetcher.isLoading}
        <div>loading</div>
      {/if}
    </div>
  </div>
  <div class="row">
    <div class="col-12">
      <!-- <ItemsPreview data={finalData} mapping={wizard.mapping} /> -->
      <TableMatchPreview data={wizard.mapping} />
    </div>
  </div>
</div>

<BaseAlertDialog bind:open>
  {#snippet title()}
    {t("import.media-linked", { fallback: "Media linked correctly" })}
  {/snippet}
  <!-- {#snippet trigger()}
    <i class="bi bi-pencil"></i>
    {t("import.edit-link", {
      fallback: "Edit linked asset",
    })}
  {/snippet} -->
  {#snippet description()}
    <span class="fw-bold">{assetsLinked}</span>
    {t("import.match-description", {
      fallback: "media linked correctly",
    })}
  {/snippet}
  {#snippet footer()}
    <button class="btn btn-success" onclick={closeAndHome}>
      {t("common.continue", { fallback: "Continue" })}
    </button>
  {/snippet}
</BaseAlertDialog>
