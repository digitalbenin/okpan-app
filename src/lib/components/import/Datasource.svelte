<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  import { createFetcher } from "$lib/stores/useFetcher.svelte.js";
  import {
    createDatasource,
    createDatasourceWithThrow,
  } from "$lib/stores/DatasourcesUtils.js";
  const { institutions, languages } = $props();
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();

  //todo: check params if institution id is provided eg: coming from institution page
  const institution = institutions.result[0];
  let datasource = $state({
    institutionId: institution.id,
    name: "Test Data Source",
    date: new Date().toISOString(),
    notes: "some notes",
    languageId: languages[0].id,
    dateString: new Date().toISOString().split("T")[0],
  });
  $inspect(datasource);

  const datasourceFetcher = createFetcher(createDatasourceWithThrow);

  async function handleSave() {
    try {
      const response = await datasourceFetcher.fetch(datasource);
      console.log("Datasource saved:", response);
    } catch (error) {
      console.error("Error saving datasource:", error);
      // Handle error appropriately, e.g., show a notification
    }
  }
</script>

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h3>
        {t("import.datasource-start", {
          fallback:
            "Let’s start by giving your import a name and telling us where it’s from.",
        })}
      </h3>
      <p class="w-75">
        {t("import.datasource-description", {
          fallback:
            'Explain what this import is about – for example, "Sculpture Collection from City Museum". You can also add a short note to help keep track of different imports.',
        })}
      </p>
    </div>
  </div>
  <div class="row">
    <div class="col-6">
      <div class="fst-italic text-muted">replace this with real form</div>
      <div class="mb-3">
        <label for="datasourceName" class="form-label">
          {t("import.datasource-name", { fallback: "Import Name" })}
        </label>
        <input
          type="text"
          class="form-control"
          id="datasourceName"
          bind:value={datasource.name}
          placeholder={t("import.datasource-name-placeholder", {
            fallback: "Enter a name for your import",
          })}
        />
      </div>
      <div class="mb-3">
        <label for="datasourceDate" class="form-label">
          {t("import.datasource-date", { fallback: "Import Date" })}
        </label>
        <input
          type="date"
          class="form-control"
          id="datasourceDate"
          bind:value={datasource.dateString}
          placeholder={t("import.datasource-date-placeholder", {
            fallback: "Select the date of the import",
          })}
        />
      </div>
      <div class="mb-3">
        <label for="datasourceInstitution" class="form-label">
          {t("import.datasource-institution", {
            fallback: "Institution",
          })}
        </label>
        <select
          class="form-select"
          id="datasourceInstitution"
          bind:value={datasource.institutionId}
        >
          {#each institutions.result as institution}
            <option value={institution.id}>
              {institution.name.content}
            </option>
          {/each}
        </select>
      </div>
      {#if datasourceFetcher.isLoading}
        <div class="alert alert-info">
          {t("import.datasource-saving", {
            fallback: "Saving datasource...",
          })}
        </div>
      {/if}
      {#if datasourceFetcher.error}
        <div class="alert alert-danger">
          {t("import.datasource-error", {
            fallback: "An error occurred while saving the datasource.",
          })}
          {datasourceFetcher.error}
        </div>
      {:else if datasourceFetcher.data && !datasourceFetcher.isLoading}
        <div class="alert alert-success">
          {t("import.datasource-success", {
            fallback: "Datasource saved successfully!",
          })}
        </div>
      {/if}
      <button
        class="btn btn-primary"
        onclick={handleSave}
        disabled={datasourceFetcher.isLoading}
      >
        {t("common.save", { fallback: "Save" })}
      </button>
    </div>
  </div>
</div>
