<script>
  import { watch } from "runed";
  import { IconBulb } from "@tabler/icons-svelte";

  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { getImportAssetsWizardContext } from "$lib/stores/ImportAssetsWizard.svelte.js";
  let { institutions } = $props();

  const wizard = getImportAssetsWizardContext();
  const { t } = getTranslationStore();
  watch(
    () => wizard.institutionId,
    (id) => {
      if (id) {
        wizard.nextEnabled = true;
      } else {
        wizard.nextEnabled = false;
      }
    }
  );
</script>

<div class="row g-3">
  <!-- Left column: main content -->
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
    <div class="bg-white rounded-3 p-4 d-flex flex-column gap-4">
      <div>
        <h3 class="mb-1">
          {t("import-assets.select-institution-title", { fallback: "Select Institution" })}
        </h3>
        <p class="mb-0 text-body-secondary">
          {t("import-assets.select-institution-desc", {
            fallback: "Please select an institution which the asset belongs to.",
          })}
        </p>
      </div>
      <div>
        <select
          class="form-select"
          id="datasourceInstitution"
          bind:value={wizard.institutionId}
        >
          <option value="">{t("common.select-institution", { fallback: "Select institution" })}</option>
          {#each institutions as institution}
            <option value={institution.id}>
              {institution.name.content}
            </option>
          {/each}
        </select>
      </div>
    </div>
  </div>

  <!-- Right column: info sidebar -->
  <div class="col-12 col-lg-4 col-xl-3">
    <div class="bg-white border rounded-3 p-4">
      <div class="d-flex flex-column gap-3">
        <div class="flex-shrink-0">
          <IconBulb size={16} stroke={2} />
        </div>
        <div>
          <p class="fw-semibold mb-1 text-body">
            {t("import-assets.institution-help-title", { fallback: "How should I fill this?" })}
          </p>
          <div class="text-body-secondary fs-7">
            <p class="mb-2">
              {t("import-assets.institution-help-desc-p1", {
                fallback: "Choose the institution that owns or manages the assets you are about to import. This helps Okpan organise your media files and link them to the right objects later.",
              })}
            </p>
            <p class="mb-0">
              {t("import-assets.institution-help-desc-p2", {
                fallback: "If you don't see the right institution, make sure you have added it to your project first.",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
