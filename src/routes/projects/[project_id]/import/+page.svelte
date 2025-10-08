<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { queryParameters, ssp } from "sveltekit-search-params";
  const { t } = getTranslationStore();
  const { data } = $props();

  // Read institution_id from query params and preserve it when navigating to steps
  const params = queryParameters({
    institution_id: ssp.string(undefined)
  });
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
        href={"/projects/" + data.project.id + "/import/steps" + (params.institution_id ? ("?institution_id=" + encodeURIComponent(params.institution_id)) : "")}
      >
        {t("import.start", { fallback: "Start" })}
      </a>
    </div>
  </div>
</div>
