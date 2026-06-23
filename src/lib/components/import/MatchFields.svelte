<script>
  import { IconHelp } from "@tabler/icons-svelte";
  import Dsv from "./matchPreview/Dsv.svelte";
  import Json from "./matchPreview/Json.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportWizardContext } from "$lib/stores/ImportWizard.svelte.js";
  const { t } = getTranslationStore();
  const wizard = getImportWizardContext();
</script>

<div class="row g-3">
  <!-- Left column: main match content -->
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
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
  </div>

  <!-- Right column: info sidebar -->
  <div class="col-12 col-lg-4 col-xl-3">
    <div class="bg-white border rounded-3 p-4 d-flex flex-column">
      <div class="d-flex flex-column gap-3">
        <div class="flex-shrink-0">
          <IconHelp size={16} stroke={2} />
        </div>
        <div>
          <p class="fw-semibold mb-1 text-body">
            {t("import.how-to-fill-title", { fallback: "How should I fill this?" })}
          </p>
          <div class="text-body-secondary fs-7">
            <p class="mb-2">
              {t("import.how-to-fill-desc-p1", {
                fallback:
                  'Connect the columns in your file to the fields in Okpan. Your file may call things differently — "Medium" instead of "Material", for example.',
              })}
            </p>
            <p class="mb-0">
              {t("import.how-to-fill-desc-p2", {
                fallback: "Okpan suggests matches automatically, but always review them. Columns you don't need can be not imported.",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
