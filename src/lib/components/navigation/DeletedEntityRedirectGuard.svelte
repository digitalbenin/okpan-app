<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import BaseModal from "$lib/components/base/BaseModal.svelte";
  import { getInstitution } from "$lib/api/InstitutionsApi.js";
  import { getObjectById } from "$lib/api/ObjectsApi.js";
  import { getAssetById } from "$lib/api/AssetsApi.js";
  import { getResearchFieldById, getVocabularyById } from "$lib/api/ResearchFieldsApi.js";

  const ENTITY_LABELS = {
    institution: "institution",
    object: "object",
    asset: "asset",
    connection: "connection",
  };

  let showDialog = $state(false);
  let deletedEntityType = $state(null);
  let lastHandledPath = $state(null);
  let checkGeneration = 0;

  function getProjectHomePath() {
    const projectId = page.params.project_id;
    return projectId ? `/projects/${projectId}` : "/projects";
  }

  function resetDialogIfRouteChanged() {
    if (showDialog && lastHandledPath !== page.url.pathname) {
      showDialog = false;
      deletedEntityType = null;
      lastHandledPath = null;
    }
  }

  function getRouteChecks() {
    const checks = [];
    const { institution_id, object_id, asset_id, connectionId, vocabularyId } = page.params;

    if (institution_id) {
      checks.push({ type: "institution", id: institution_id });
    }
    if (object_id) {
      checks.push({ type: "object", id: object_id });
    }
    if (asset_id) {
      checks.push({ type: "asset", id: asset_id });
    }
    if (connectionId) {
      checks.push({ type: "connection", id: connectionId });
    }
    if (vocabularyId) {
      checks.push({ type: "connection-vocabulary", id: vocabularyId });
    }

    return checks;
  }

  async function entityExists(check) {
    try {
      switch (check.type) {
        case "institution": {
          const institution = await getInstitution(check.id);
          const resolved = Array.isArray(institution) ? institution[0] : institution;
          return Boolean(resolved?.id);
        }
        case "object": {
          const response = await getObjectById(check.id);
          if (response?.error && !/not found/i.test(String(response.error))) {
            return true;
          }
          return Boolean(response?.result?.id);
        }
        case "asset": {
          const response = await getAssetById(check.id);
          if (response?.error && !/not found/i.test(String(response.error))) {
            return true;
          }
          const asset = Array.isArray(response?.result)
            ? response.result[0]
            : response?.result;
          return Boolean(asset?.id);
        }
        case "connection": {
          const response = await getResearchFieldById(check.id);
          if (response?.error && !/not found/i.test(String(response.error))) {
            return true;
          }
          return Boolean(response?.result?.id);
        }
        case "connection-vocabulary": {
          const response = await getVocabularyById(check.id);
          if (response?.error && !/not found/i.test(String(response.error))) {
            return true;
          }
          return Boolean(response?.result?.id);
        }
        default:
          return true;
      }
    } catch (_) {
      return true;
    }
  }

  async function verifyActiveRoute() {
    resetDialogIfRouteChanged();

    const currentPath = page.url.pathname;
    if (!page.params.project_id || !currentPath.startsWith("/projects/")) {
      return;
    }
    if (showDialog && lastHandledPath === currentPath) {
      return;
    }

    const checks = getRouteChecks();
    if (checks.length === 0) {
      return;
    }

    const generation = ++checkGeneration;
    for (const check of checks) {
      const exists = await entityExists(check);
      if (generation !== checkGeneration || page.url.pathname !== currentPath) {
        return;
      }
      if (!exists) {
        deletedEntityType = check.type === "connection-vocabulary" ? "connection" : check.type;
        lastHandledPath = currentPath;
        showDialog = true;
        return;
      }
    }
  }

  async function handleReturnHome() {
    showDialog = false;
    const target = getProjectHomePath();
    deletedEntityType = null;
    lastHandledPath = target;
    await goto(target);
  }

  onMount(() => {
    let debounceTimer;
    const scheduleVerification = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void verifyActiveRoute();
      }, 100);
    };

    scheduleVerification();

    const unsubscribe = window.api?.onDataChanged
      ? window.api.onDataChanged(() => {
          scheduleVerification();
        })
      : null;

    return () => {
      clearTimeout(debounceTimer);
      unsubscribe?.();
    };
  });

  $effect(() => {
    page.url.pathname;
    page.params.project_id;
    page.params.institution_id;
    page.params.object_id;
    page.params.asset_id;
    page.params.connectionId;
    page.params.vocabularyId;
    void verifyActiveRoute();
  });

  const dialogTitle = $derived(
    deletedEntityType
      ? `${ENTITY_LABELS[deletedEntityType][0].toUpperCase()}${ENTITY_LABELS[deletedEntityType].slice(1)} deleted`
      : "Entity deleted"
  );

  const dialogMessage = $derived(
    deletedEntityType
      ? `This ${ENTITY_LABELS[deletedEntityType]} was deleted by another peer. You will be returned to the project home.`
      : "This entity was deleted by another peer. You will be returned to the project home."
  );
</script>

<BaseModal bind:isOpen={showDialog} size="md">
  {#snippet header()}{dialogTitle}{/snippet}
  {#snippet body()}
    <p class="mb-0">{dialogMessage}</p>
  {/snippet}
  {#snippet actions()}
    <button type="button" class="btn btn-primary" onclick={handleReturnHome}>
      Return to project home
    </button>
  {/snippet}
</BaseModal>