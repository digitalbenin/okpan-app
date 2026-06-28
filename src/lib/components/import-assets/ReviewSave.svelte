<script>
  import BaseAlertDialog from "$lib/components/base/BaseAlertDialog.svelte";
  import ImportStatsAsset from "./ImportStatsAsset.svelte";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import { bulkLinkAssetsToObjects } from "$lib/api/AssetsApi.js";
  import { goto } from "$app/navigation";
  import TableMatchPreview from "./TableMatchPreview.svelte";
  import { onMount, onDestroy } from "svelte";

  const { t } = getTranslationStore();
  const wizard = getImportAssetsWizardContext();

  const saveFetcher = createFetcher(bulkLinkAssetsToObjects);

  let open = $state(false);
  let isImporting = $state(false);
  let importProgressPercent = $state(0);
  let importProgressText = $state("");
  let importErrors = $state([]);

  let unsubscribeImportProgress;

  onMount(() => {
    if (window.api?.onImportProgress) {
      unsubscribeImportProgress = window.api.onImportProgress((data) => {
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
    unsubscribeImportProgress?.();
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
        return { ...entry, asset_id: created.id };
      })
      .filter(Boolean);
  }

  const handleSave = async function () {
    if (wizard.saving) return;
    try {
      wizard.saving = true;
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
      await saveFetcher.fetch(
        saveParams
          .filter((m) => m.object_ids && m.object_ids.length > 0)
          .map((m) => ({ asset_id: m.asset_id, object_ids: m.object_ids }))
      );
      wizard.importCompleted = true;
      open = true;
    } catch (error) {
      console.error("Error linking assets:", error);
    } finally {
      isImporting = false;
      wizard.saving = false;
    }
  };

  wizard.save = handleSave;

  const assetsImported = $derived(wizard.assets?.length || 0);
  const assetsLinked = $derived(wizard.mapping.filter((m) => m.object_ids && m.object_ids.length > 0).length);
  const assetsNotLinked = $derived(Math.max(0, assetsImported - assetsLinked));

  function closeAndHome() {
    open = false;
    goto("/projects/" + wizard.projectId);
  }
</script>

<div class="row g-3">
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
    <div class="bg-white rounded-3 p-4 d-flex flex-column gap-4">
      <div>
        <h3 class="mb-1">
          {t("import-assets.review-title", { fallback: "Review your data and save it to the archive." })}
        </h3>
        <p class="mb-0 text-body-secondary">
          {t("import-assets.review-description", { fallback: "In this step, you will see a summary of your data and can make final adjustments before saving it to the archive." })}
        </p>
      </div>

      <ImportStatsAsset {assetsImported} {assetsLinked} />

      {#if isImporting}
        <div class="w-100" style="max-width: 320px;">
          <div class="progress" role="progressbar" aria-label={t("common.import-progress", { fallback: "Import progress" })} aria-valuenow={importProgressPercent} aria-valuemin="0" aria-valuemax="100" style="height: 10px;">
            <div class="progress-bar" style="width: {importProgressPercent}%"></div>
          </div>
          <div class="text-end fs-7 text-body-secondary mt-1">{importProgressText}</div>
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

      <TableMatchPreview data={wizard.mapping} />
    </div>
  </div>
</div>

<BaseAlertDialog bind:open noClose>
  {#snippet title()}
    {t("import.media-import-completed", { fallback: "Media import completed" })}
  {/snippet}
  {#snippet description()}
    <div>
      <p class="mb-2">
        <span class="fw-bold">{assetsImported}</span> {t("import.assets-imported", { fallback: "Files imported" })}
      </p>
      {#if assetsLinked > 0}
        <p class="mb-2">
          <span class="fw-bold">{assetsLinked}</span> {t("import.assets-linked", { fallback: "were linked to objects" })}
        </p>
      {/if}
      {#if assetsNotLinked > 0}
        <p class="mb-0">
          <span class="fw-bold">{assetsNotLinked}</span> {t("import.no-media-linked", { fallback: "Not linked to any object" })}
        </p>
      {/if}
    </div>
  {/snippet}
  {#snippet footer()}
    <button class="btn btn-success" onclick={closeAndHome}>
      {t("common.continue", { fallback: "Continue" })}
    </button>
  {/snippet}
</BaseAlertDialog>
