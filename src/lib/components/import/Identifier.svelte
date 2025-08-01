<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import IdentifierRadioGroup from "./IdentifierRadioGroup.svelte";
  const { ontologyFields } = $props();
  const { t } = getTranslationStore();
</script>

<div class="container-fluid mt-3">
  <div class="row">
    <div class="col-12">
      <h3>
        {t("import.identifier-start", {
          fallback:
            "Select the field that contains a unique identifier – like an inventory number, object ID, or title.",
        })}
      </h3>
      <p class="w-75">
        {t("import.identifier-description", {
          fallback:
            "This might be a unique ID, a title, or an internal code used by the institution. It helps us tell objects apart and keep your archive organized.",
        })}
      </p>
    </div>
  </div>
  <IdentifierRadioGroup {ontologyFields} />
</div>
