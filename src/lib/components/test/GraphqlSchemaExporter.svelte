<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  const { t } = getTranslationStore();

  let schemaSdl = $state("");
  let exportStatus = $state("");

  const clearStatusLater = () => {
    setTimeout(() => {
      exportStatus = "";
    }, 3000);
  };

  const handleLoadSchema = async () => {
    exportStatus = "Loading schema SDL...";

    const response = await window.api.exportGraphQLSchema();
    if (!response?.success) {
      schemaSdl = JSON.stringify(response, null, 2);
      exportStatus = "Schema export failed.";
      clearStatusLater();
      return;
    }

    schemaSdl = response.data?.schema || "";
    exportStatus = "Schema SDL loaded.";
    clearStatusLater();
  };

  const handleDownloadSchema = async () => {
    exportStatus = "Writing schema file...";

    const response = await window.api.exportGraphQLSchema("docs/graphql/schema.graphql");
    if (!response?.success) {
      schemaSdl = JSON.stringify(response, null, 2);
      exportStatus = "Schema export failed.";
      clearStatusLater();
      return;
    }

    schemaSdl = response.data?.schema || schemaSdl;
    exportStatus = `Schema written to ${response.data?.outputPath || "docs/graphql/schema.graphql"}.`;
    clearStatusLater();
  };
</script>

<div class="mb-4">
  <div class="border rounded p-3">
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <h5 class="mb-0">{t("test.schemaExport", { fallback: "Schema Export" })}</h5>
      <BaseButton
        text={t("test.schemaLoad", { fallback: "Load SDL" })}
        onClick={handleLoadSchema}
        class="btn btn-outline-secondary btn-sm"
      />
      <BaseButton
        text={t("test.schemaWrite", { fallback: "Write docs/graphql/schema.graphql" })}
        onClick={handleDownloadSchema}
        class="btn btn-outline-primary btn-sm"
      />
    </div>

    {#if exportStatus}
      <div class="alert alert-info py-2 mb-3" role="alert">{exportStatus}</div>
    {/if}

    <textarea
      class="form-control font-monospace"
      rows="10"
      bind:value={schemaSdl}
      readonly
      placeholder="GraphQL schema SDL will appear here..."
    ></textarea>
  </div>
</div>