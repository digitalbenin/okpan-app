<script>
  import { IconQuestionMark } from "@tabler/icons-svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import IdentifierRadioGroup from "./IdentifierRadioGroup.svelte";
  const { ontologyFields } = $props();
  const { t } = getTranslationStore();
</script>

<div class="row g-3">
  <!-- Left column: main content -->
  <div class="col-12 col-lg-8 col-xl-9 min-w-0 mb-5">
    <div class="bg-white rounded-3 p-4">
      <div>
        <h3>
          {t("import.identifier-start", {
            fallback:
              "Select the field that contains a unique identifier – like an inventory number, object ID, or title.",
          })}
        </h3>
        <p class="mb-0 text-body-secondary">
          {t("import.identifier-description", {
            fallback:
              "This might be a unique ID, a title, or an internal code used by the institution. It helps us tell objects apart and keep your archive organized.",
          })}
        </p>
      </div>
      <div class="mt-3">
        <IdentifierRadioGroup {ontologyFields} />
      </div>
    </div>
  </div>

  <!-- Right column: info sidebar -->
  <div class="col-12 col-lg-4 col-xl-3">
    <div class="bg-white border rounded-3 p-4">
      <div class="d-flex flex-column gap-3">
        <div class="flex-shrink-0">
          <IconQuestionMark size={16} stroke={2} />
        </div>
        <div>
          <p class="fw-semibold mb-1 text-body">
            {t("import.identifier-help-title", { fallback: "How should I fill this?" })}
          </p>
          <div class="text-body-secondary fs-7">
            <p class="mb-2">
              {t("import.identifier-help-desc-p1", {
                fallback:
                  "Choose the field that contains a unique code for each object — usually an accession or catalogue number.",
              })}
            </p>
            <p class="mb-0">
              {t("import.identifier-help-desc-p2", {
                fallback: "Okpan uses this to tell objects apart and to update existing records safely if you re-import the same file in the future.",
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
