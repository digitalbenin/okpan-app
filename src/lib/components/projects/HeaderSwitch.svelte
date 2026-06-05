<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { IconTable, IconEye } from "@tabler/icons-svelte";

  const { t } = getTranslationStore();

  const isDataEditor = $derived(
    !page.url.pathname.startsWith(`/projects/${page.data.project.id}/explorer`)
  );
</script>

<div class="d-flex rounded-1 p-1 align-items-center bg-gray-300" style="gap: 6px;">
  <a
    href={`/projects/${page.data.project.id}`}
    class="btn btn-sm d-flex align-items-center gap-2 text-decoration-none"
    class:bg-gray-100={isDataEditor}
    class:border={isDataEditor}
    class:border-gray-100={isDataEditor}
    class:text-body={isDataEditor}
    class:text-primary-emphasis={!isDataEditor}
  >
    <IconTable size={14} stroke={2} />
    {t("project.data-editor", { fallback: "Data editor" })}
  </a>
  <a
    href={`/projects/${page.data.project.id}/explorer`}
    class="btn btn-sm d-flex align-items-center gap-2 text-decoration-none"
    class:bg-gray-100={!isDataEditor}
    class:border={!isDataEditor}
    class:border-gray-100={!isDataEditor}
    class:text-body={!isDataEditor}
    class:text-primary-emphasis={isDataEditor}
  >
    <IconEye size={14} stroke={2} />
    {t("project.data-explorer", { fallback: "Website preview" })}
  </a>
</div>
