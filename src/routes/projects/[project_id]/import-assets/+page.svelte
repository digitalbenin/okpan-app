<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();
  const { data } = $props();

  const startHref = $derived.by(() => {
    const search = page.url.search || "";
    return `/projects/${data.project.id}/import-assets/steps${search}`;
  });
</script>

<div
  class="bg-light w-100 h-100 d-flex align-items-center justify-content-center"
>
  <div class="bg-white rounded border w-50 p-3">
    <h2>
      {t("import-assets.begin", {
        fallback: "Begin assets import and matching",
      })}
    </h2>
    <p>
      {t("import-assets.description", {
        fallback: "This page allows you to import assets into your project.",
      })}
    </p>
    <div class="text-center">
      <a
        class="btn btn-primary btn-lg"
        href={startHref}
      >
        {t("import.start", { fallback: "Start" })}
      </a>
    </div>
  </div>
</div>
