<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();
  const { data } = $props();
</script>

<div
  class="bg-light w-100 h-100 d-flex align-items-center justify-content-center"
>
  <div class="bg-white rounded border w-50 p-3">
    <h2>{t("import.begin", { fallback: "Begin data import" })}</h2>
    <p>
      {t("import.description", {
        fallback:
          "This page allows you to import data into your project. You can upload files or connect to external data sources.",
      })}
    </p>
    <div class="text-center">
      <a
        class="btn btn-primary btn-lg"
        href="/projects/{data.project.id}/import/steps"
      >
        {t("import.start", { fallback: "Start" })}
      </a>
    </div>
  </div>
</div>
