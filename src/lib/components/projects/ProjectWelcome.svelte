<script>
  import { page as pageData } from "$app/state";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import InfoBox from "$lib/components/projects/InfoBox.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconBuildingBank, IconChartCircles, IconFileImport, IconPlus } from "@tabler/icons-svelte";

  let { institutionsCount = 0 } = $props();
  const { t } = getTranslationStore();
  const projectId = $derived(pageData.data.project.id);
  const baseUrl = $derived(`/projects/${projectId}`);
  const hasInstitutions = $derived((institutionsCount ?? 0) > 0);
</script>

<div>
  <div class="row">
    <div class="col-12">
      <h1 class="fw-normal mb-2 text-body" style="font-family: 'Crimson Pro', serif; font-size: 40px; letter-spacing: -0.8px; line-height: 1.2;">
        {t("project.welcome-title", { fallback: "Where would you like to begin?" })}
      </h1>
      <p class="text-body mb-4">
        {t("project.welcome-description", {
          fallback:
            "Ọkpan helps you connect cultural objects across institutions — linking collections, vocabularies, and sources in one structured workspace.",
        })}
      </p>

      <InfoBox
        title={t("project.welcome-info-title", { fallback: "New to Ọkpan?" })}
        description={t("project.welcome-info-description", {
          fallback: "We recommend starting by adding at least one institution, then importing your first dataset.",
        })}
      />
    </div>
  </div>

  <div class="row g-4 mt-4">
    

    <div class="col-12 col-md-4">
      <div class="h-100 border rounded-4 p-3 bg-white d-flex flex-column justify-content-between">
        <div class="mb-4">
          <div class="d-flex text-blue-400 align-items-center justify-content-center bg-blue-100 rounded-4 mb-3" style="width: 64px; height: 64px; padding: 10px;">
            <IconBuildingBank size={32} stroke={2} />
          </div>
          <h3 class="fw-normal">
            {t("menu.add-institution", { fallback: "Add an Institution" })}
          </h3>
          <p class="fs-7 mb-0">
            {t("project.welcome-institution-description", {
              fallback: "Add institutions, museums or archives where the data about your collection are coming from.",
            })}
          </p>
        </div>
        <div>
          <a class="btn btn-sm btn-outline-secondary" href={`${baseUrl}/institutions/add`}>
          <IconPlus size={14} stroke={2} class="me-1" />
            {t("menu.add-institution", { fallback: "Add an Institution" })}
          </a>
        </div>
      </div>
    </div>

    <div class="col-12 col-md-4">
      <div class="h-100 border rounded-4 p-3 bg-white d-flex flex-column justify-content-between">
        <div class="mb-4">
          <div class="d-flex text-green-400 align-items-center justify-content-center bg-green-100 rounded-4 mb-3" style="width: 64px; height: 64px; padding: 10px;">
            <IconFileImport size={32} stroke={2} />
          </div>
          <h3 class="fw-normal">
            {t("menu.import-data", { fallback: "Import Data" })}
          </h3>
          <p class="fs-7 mb-0">
            {t("project.welcome-import-description", {
              fallback: "Start batch importing data about your research objects from CSV, JSON or XML files.",
            })}
          </p>
        </div>
        <div>
          {#if hasInstitutions}
            <a class="btn btn-sm btn-outline-secondary" href={`${baseUrl}/import-data`}>
              <IconFileImport size={14} stroke={2} class="me-1" />
              {t("menu.import-data", { fallback: "Import Data" })}
            </a>
          {:else}
            <BaseTooltip>
              {#snippet trigger(props)}
                <span {...props}>
                  <button class="btn btn-sm btn-outline-secondary" type="button" disabled>
                    <IconFileImport size={14} stroke={2} class="me-1" />
                    {t("menu.import-data", { fallback: "Import Data" })}
                  </button>
                </span>
              {/snippet}
              {#snippet children()}
                {t("project.welcome-import-requires-institution", {
                  fallback: "Create at least one institution to import data.",
                })}
              {/snippet}
            </BaseTooltip>
          {/if}
        </div>
      </div>
    </div>
    <div class="col-12 col-md-4">
      <div class="h-100 border  rounded-4 p-3 bg-white d-flex flex-column justify-content-between">
        <div class="mb-4">
          <div class="d-flex text-orange-400 align-items-center justify-content-center bg-orange-100 rounded-4 mb-3" style="width: 64px; height: 64px; padding: 10px;">
            <IconChartCircles size={32} stroke={2} />
          </div>
          <h3 class="fw-normal">
            {t("project.connection-types", { fallback: "Connection types" })}
          </h3>
          <p class="fs-7 mb-0">
            {t("project.welcome-connections-description", {
              fallback: "Set up connections for your project so you can link objects to controlled vocabularies and shared terms.",
            })}
          </p>
        </div>
        <div>
          <a class="btn btn-sm btn-outline-secondary" href={`${baseUrl}/connections`}>
            <IconPlus size={14} stroke={2} class="me-1" />
            {t("project.add_connection_type", { fallback: "Add a new connection type" })}
          </a>
        </div>
      </div>
    </div>
  </div>
</div>
