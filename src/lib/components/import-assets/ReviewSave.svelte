<script>
  //   import ItemsPreview from "./ItemsPreview.svelte";
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import { bulkLinkAssetsToObjects } from "$lib/stores/AssetsUtils.js";
  import { goto } from "$app/navigation";
  import TableMatchPreview from "./TableMatchPreview.svelte";
  import { onMount, onDestroy } from "svelte";

  // import { parseData } from "$lib/utils/import.js";

  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();

  const saveFetcher = createFetcher(bulkLinkAssetsToObjects);

  let open = $state(false);
  let isImporting = $state(false);
  let importProgressPercent = $state(0);
  let importProgressText = $state("");
  let importErrors = $state([]);

  onMount(() => {
    if (window.api && window.api.onImportProgress) {
      window.api.onImportProgress((_event, data) => {
        if (!isImporting) return;
        if (data.status === "start") {
          importProgressPercent = 0;
          importProgressText = `0 / ${data.total}`;
        } else if (data.status === "progress") {
          importProgressPercent = data.percent;
          importProgressText = `${data.processed} / ${data.total}`;
        } else if (data.status === "complete") {
          importProgressPercent = 100;
        }
      });
    }
  });

  onDestroy(() => {
    if (window.api && window.api.removeImportProgressListeners) {
      window.api.removeImportProgressListeners();
    }
  });

  function mapTempIdsToCreatedAssets(createdAssets, stagedAssets) {
    const sourcePathToAsset = new Map(
      (createdAssets || []).map((asset) => [asset?._sourcePath, asset]).filter(([key]) => Boolean(key))
    );

    const tempAssetsById = new Map((stagedAssets || []).map((asset) => [asset.id, asset]));

    return (wizard.mapping || [])
      .map((entry) => {
        const tempAsset = tempAssetsById.get(entry.asset_id);
        const sourcePath = tempAsset?._sourcePath;
        const created = sourcePath ? sourcePathToAsset.get(sourcePath) : null;
        if (!created?.id) return null;
        return {
          ...entry,
          asset_id: created.id,
        };
      })
      .filter(Boolean);
  }

  const handleSave = async function () {
    try {
      importErrors = [];
      isImporting = true;
      importProgressPercent = 0;
      importProgressText = "";

      const payload = {
        path: $state.snapshot(wizard.selectedFilePaths || []),
        isDirectory: false,
        projectId: wizard.projectId,
        institutionId: wizard.institutionId,
      };

      const { errors, createdAssets } = await window.api.importAssets(payload);
      importErrors = errors?.length ? errors : [];

      const importedAssets = createdAssets ? createdAssets : [];
      const stagedAssets = $state.snapshot(wizard.assets || []);
      const remapped = mapTempIdsToCreatedAssets(importedAssets, stagedAssets);

      wizard.assets = importedAssets;
      wizard.hasPersistedAssets = importedAssets.length > 0;
      wizard.mapping = remapped;

      const saveParams = $state.snapshot(remapped);

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
      wizard.importCompleted = true;
      open = true;
      console.log("Assets linked:", response);
    } catch (error) {
      console.error("Error linking assets:", error);
      // Handle error appropriately, e.g., show a notification
    } finally {
      isImporting = false;
    }
  };

  wizard.save = handleSave;

  //   const finalData = $derived(
  //     parseData(wizard.data, wizard.mapping, wizard.file.format)
  //   );

  const assetsLinked = $derived.by(() => {
    return wizard.mapping.filter((m) => m.object_ids && m.object_ids.length > 0)
      .length;
  });
  const assetsImported = $derived.by(() => wizard.assets?.length || 0);
  const assetsNotLinked = $derived.by(() =>
    Math.max(0, assetsImported - assetsLinked)
  );

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
      <div class="alert alert-primary" role="alert" style="width: fit-content">
        <div>
          <span class="fw-bold me-1">{assetsImported}</span>
          {t("import.assets-will-be-imported", {
            fallback: "media will be imported.",
          })}
        </div>
        <div>
          {#if assetsNotLinked > 0}
            <span class="fw-bold me-1">{assetsNotLinked}</span>
            {t("import.media-not-linked", {
              fallback: "media is not linked.",
            })}
          {:else}
            <span class="fw-bold me-1">{assetsLinked}</span>
            {t("import.assets-will-be-linked", {
              fallback: "media will be linked.",
            })}
          {/if}
        </div>
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
        <div>{t("common.loading", { fallback: "Loading..." })}</div>
      {/if}
      {#if isImporting}
        <div class="mt-2 w-100" style="max-width: 320px;">
          <div
            class="progress"
            role="progressbar"
            aria-label={t("common.import-progress", { fallback: "Import progress" })}
            aria-valuenow={importProgressPercent}
            aria-valuemin="0"
            aria-valuemax="100"
            style="height: 10px;"
          >
            <div class="progress-bar" style="width: {importProgressPercent}%"></div>
          </div>
          <div class="text-end fs-7 text-muted mt-1">{importProgressText}</div>
        </div>
      {/if}
      {#if importErrors.length}
        <div class="alert alert-danger mt-2 mb-0">
          <h4>{t("common.errors-occurred", { fallback: "Some errors occurred:" })}</h4>
          <ul>
            {#each importErrors as err}
              <li>{typeof err === 'string' ? err : (err?.message || err?.error || 'Unknown error')}</li>
            {/each}
          </ul>
        </div>
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
    {t("import.media-import-completed", { fallback: "Media import completed" })}
  {/snippet}
  <!-- {#snippet trigger()}
    <i class="bi bi-pencil"></i>
    {t("import.edit-link", {
      fallback: "Edit linked asset",
    })}
  {/snippet} -->
  {#snippet description()}
    <div class="d-flex flex-column gap-1">
      <div>
        {t("import.assets-imported", { fallback: "Imported media:" })}
        <span class="fw-bold ms-1">{assetsImported}</span>
      </div>
      <div>
        {#if assetsLinked}
          {t("import.assets-linked", { fallback: "Linked media:" })}
          <span class="fw-bold ms-1">{assetsLinked}</span>
        {:else}
          {t("import.no-media-linked", { fallback: "No media were linked." })}
        {/if}
      </div>
    </div>
  {/snippet}
  {#snippet footer()}
    <button class="btn btn-success" onclick={closeAndHome}>
      {t("common.continue", { fallback: "Continue" })}
    </button>
  {/snippet}
</BaseAlertDialog>
