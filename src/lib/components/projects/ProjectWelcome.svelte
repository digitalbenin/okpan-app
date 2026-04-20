<script>
  import { page as pageData } from "$app/state";
  import BaseTooltip from "$lib/components/base/BaseTooltip.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  let { institutionsCount = 0 } = $props();
  const { t } = getTranslationStore();
  const projectId = $derived(pageData.data.project.id);
  const baseUrl = $derived(`/projects/${projectId}`);
  const hasInstitutions = $derived((institutionsCount ?? 0) > 0);
</script>

<div class="container-fluid py-4">
  <div class="row">
    <div class="col-12 col-lg-10">
      <h2 class="fw-semibold mb-2">
        {t("project.welcome.title", { fallback: "Where do you want to start?" })}
      </h2>
      <p class="text-muted">
        {t("project.welcome.description", {
          fallback:
            "Start your project with the right foot. This platform helps you research and connect data about cultural objects from diverse institutions, bringing knowledge and heritage together in one place.",
        })}
      </p>
    </div>
  </div>

  <div class="row g-4 mx-3 mt-1">
    <!-- Define connections -->
    <div class="col-12 col-md-4">
      <div
        class="h-100 border rounded p-3 bg-white d-flex flex-column justify-content-between"
      >
        <div class="mb-3 text-muted">
          <i
            class="bi bi-share-fill fs-1 mb-3 d-block"
            style="color:#dddddd"
          ></i>
          <div class="mb-3">
            <div class="h4 mb-0">{t("project.connection-types", { fallback: "Connection types" })}</div>
          </div>
          <p class="text-muted">
            {t("project.welcome.connections-description", {
              fallback:
                "Set up connections for your project so you can link objects to controlled vocabularies and shared terms.",
            })}
          </p>
        </div>
        <div>
          <a
            class="btn btn-primary"
            href={`${baseUrl}/connections`}
            >{t("project.add_connection_type", {
              fallback: "Add a new connection type",
            })}</a
          >
        </div>
      </div>
    </div>

    <!-- Create an institution -->
    <div class="col-12 col-md-4">
      <div
        class="h-100 border rounded p-3 bg-white d-flex flex-column justify-content-between"
      >
        <div class="mb-3 text-muted">
          <i class="bi bi-bank fs-1 d-block mb-3" style="color:#dddddd"></i>
          <div class="mb-3">
            <div class="h4 mb-0">{t("menu.add-institution", { fallback: "Add Institution" })}</div>
          </div>
          <p class="text-muted">
            {t("project.welcome.institution-description", {
              fallback:
                "Add institutions, museums or archives where the data about your collection are coming from.",
            })}
          </p>
        </div>
        <div>
          <a class="btn btn-primary" href={`${baseUrl}/institutions/add`}
            >{t("menu.add-institution", { fallback: "Add Institution" })}</a
          >
        </div>
      </div>
    </div>

    <!-- Import data -->
    <div class="col-12 col-md-4">
      <div
        class="h-100 border rounded p-3 bg-white d-flex flex-column justify-content-between"
      >
        <div class="mb-3">
          <i class="bi bi-box fs-1 d-block mb-3" style="color:#dddddd"></i>
          <div class="mb-3">
            <div class="h4 mb-0">{t("menu.import-data", { fallback: "Import Data" })}</div>
          </div>
          <p class="text-muted">
            {t("project.welcome.import-description", {
              fallback:
                "Start batch importing data about your research objects from CSV, JSON or XML files.",
            })}
          </p>
        </div>
        <div>
          {#if hasInstitutions}
            <a class="btn btn-primary" href={`${baseUrl}/import-data`}
              >{t("menu.import-data", { fallback: "Import Data" })}</a
            >
          {:else}
            <BaseTooltip>
              {#snippet trigger(props)}
                <span {...props}>
                  <button class="btn btn-primary" type="button" disabled>
                    {t("menu.import-data", { fallback: "Import Data" })}
                  </button>
                </span>
              {/snippet}
              {#snippet children()}
                {t("project.welcome.import-requires-institution", {
                  fallback: "Create at least one institution to import data.",
                })}
              {/snippet}
            </BaseTooltip>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
