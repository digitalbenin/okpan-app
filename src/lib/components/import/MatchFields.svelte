<script>
  import Dsv from "./matchPreview/Dsv.svelte";
  import Json from "./matchPreview/Json.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h3>
        {t("import.match-start", {
          fallback: "Tell us what each column in your file means.",
        })}
      </h3>
      <p class="w-75">
        {t("import.match-description", {
          fallback:
            "In this step, you’ll connect the data from your file (like titles, dates, authors, etc.) to our shared structure. This helps make the objects searchable and comparable across different institutions.",
        })}
      </p>
    </div>
  </div>
  {#if wizard.file.format === "csv" || wizard.file.format === "tsv" || wizard.file.format === "xlsx" || wizard.file.tabularized}
    <Dsv data={wizard.data} />
  {:else if wizard.file.format === "json" || wizard.file.format === "xml"}
    <Json data={wizard.data} />
  {/if}
</div>
