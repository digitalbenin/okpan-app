<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();

  const isDataEditor = $derived(
    !page.url.pathname.startsWith(`/projects/${page.data.project.id}/explorer`)
  );
</script>

<div class="d-flex rounded-2 p-1 gap-1" style="background-color: #eaebe7;">
  <a
    href={`/projects/${page.data.project.id}`}
    class="btn btn-sm d-flex align-items-center gap-1"
    class:bg-white={isDataEditor}
    class:border={isDataEditor}
    class:text-body={isDataEditor}
    class:text-secondary={!isDataEditor}
  >
    <i class="bi bi-table"></i>
    {t("project.data-editor", { fallback: "Data editor" })}
  </a>
  <a
    href={`/projects/${page.data.project.id}/explorer`}
    class="btn btn-sm d-flex align-items-center gap-1"
    class:bg-white={!isDataEditor}
    class:border={!isDataEditor}
    class:text-body={!isDataEditor}
    class:text-secondary={isDataEditor}
  >
    <i class="bi bi-eye"></i>
    {t("project.data-explorer", { fallback: "Website preview" })}
  </a>
</div>
