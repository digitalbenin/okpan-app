<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();
  $inspect(page.url.pathname);
</script>

<div class="d-flex text-bg-dark rounded p-1 gap-2">
  <a
    href="/projects/{page.data.project.id}"
    class="btn btn-sm"
    class:btn-light={!page.url.pathname.startsWith(
      `/projects/${page.data.project.id}/explorer`
    )}
    class:btn-dark={page.url.pathname.startsWith(
      `/projects/${page.data.project.id}/explorer`
    )}
    ><i class="bi bi-table"></i>
    {t("project.data-editor", { fallback: "Data editor" })}</a
  >

  <a
    href="/projects/{page.data.project.id}/explorer"
    class="btn btn-sm"
    class:btn-light={page.url.pathname.startsWith(
      `/projects/${page.data.project.id}/explorer`
    )}
    class:btn-dark={!page.url.pathname.startsWith(
      `/projects/${page.data.project.id}/explorer`
    )}
    ><i class="bi bi-eye"></i>
    {t("project.data-explorer", {
      fallback: "Data explorer",
    })}</a
  >
</div>
