<script>
  import { formatDate } from "$lib/utils/dates";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const { project } = $props();
  const { t, translationState } = getTranslationStore();
</script>

<div class="d-flex border rounded mb-4 p-3 gap-2">
  <div class="d-flex w-50 gap-2">
    <div
      class="bg-success-subtle rounded px-3 d-flex align-items-center justify-content-center"
    >
      <i class="bi bi-file-text"></i>
    </div>

    <div class="d-flex flex-column">
      <a href="/projects/{project.id}">
        {project.title.content}
      </a>
      <p class="fs-7 mb-0">
        {t("project.created-on", { fallback: "Created on" })}
        {formatDate(+project.created_at, translationState.currentLocale)}
      </p>
    </div>
  </div>
  <div class="d-flex w-50">
    <div class="col">
      <div class="fs-7">{t("project.items", { fallback: "Items" })}</div>
      <div class="fs-5">{project.objectsCount}</div>
    </div>
    <div class="col">
      <div class="fs-7">
        {t("project.assets", { fallback: "Assets" })}
      </div>
      <div class="fs-5">{project.assetsCount}</div>
    </div>
    <div class="col">
      <div class="fs-7">
        {t("project.collections", { fallback: "Collections" })}
      </div>
      <div class="fs-5">{project.institutionsCount}</div>
    </div>
  </div>
</div>
