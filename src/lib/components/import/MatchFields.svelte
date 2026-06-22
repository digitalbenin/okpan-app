<script>
  import Dsv from "./matchPreview/Dsv.svelte";
  import Json from "./matchPreview/Json.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div class="bg-white rounded-3 p-4 d-flex flex-column gap-4">
  <div>
    <h3 class="mb-1">
      {t("import.match-start", {
        fallback: "Match your columns to Okpan fields",
      })}
    </h3>
    <p class="mb-0 text-body-secondary">
      {t("import.match-fields-description", {
        fallback:
          "Your file has columns with its own names. Tell Okpan which column corresponds to which field so the data ends up in the right place. Okpan has already suggested matches \u2014 review and correct them if needed.",
      })}
    </p>
  </div>
  {#if wizard.file.tabularized || wizard.file.format === "csv" || wizard.file.format === "tsv" || wizard.file.format === "xlsx"}
    <Dsv data={wizard.data} />
  {:else if wizard.file.format === "json" || wizard.file.format === "xml"}
    <Json data={wizard.data} />
  {/if}
</div>
