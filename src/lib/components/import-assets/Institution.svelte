<script>
  import { watch } from "runed";

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

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h2 class="mt-3">
        {t("common.select-institution", { fallback: "Select Institution" })}
      </h2>
      <p>
        {t("common.select-institution-desc", {
          fallback: "Please select an institution which the asset belongs to.",
        })}
      </p>
    </div>
  </div>
  <div class="row">
    <div class="col-6">
      <div class="mb-3">
        <label for="datasourceInstitution" class="form-label">
          {t("common.institution", {
            fallback: "Institution",
          })}
        </label>
        <select
          class="form-select"
          id="datasourceInstitution"
          bind:value={wizard.institutionId}
        >
          {#each institutions as institution}
            <option value={institution.id}>
              {institution.name.content}
            </option>
          {/each}
        </select>
      </div>
    </div>
  </div>
</div>
