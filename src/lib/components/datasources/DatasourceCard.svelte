<script>
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import { formatDate } from "$lib/utils/dates";

  const { t, translationState } = getTranslationStore();
  const { datasource, projectId } = $props();
</script>

<div
  class="w-100 border rounded p-2 bg-white mb-3 d-flex flex-column gap-2 position-relative"
>
  <!-- hide this temporarily
<div class="position-absolute end-0 top-0 p-1">
    <i class="bi bi-three-dots-vertical"></i>
  </div> -->
  <div>
    <div class="fs-7 text-black-50">
      {t("common.name", { fallback: "Name" })}
    </div>
    <div class="fs-5">
      {datasource.name.content}
    </div>
  </div>
  <div>
    <div class="fs-7 text-black-50">
      {t("common.date", { fallback: "Date" })}
    </div>
    <div>
      {formatDate(+datasource.date, translationState.currentLocale)}
    </div>
  </div>
  <div>
    <div class="fs-7 text-black-50">
      {t("common.objects", { fallback: "Objects" })}
    </div>
    <div>
      {datasource.objectsCount}
    </div>
  </div>
  <a
    href="/projects/{projectId}/institutions/{datasource.institution_id}/datasources/{datasource.id}"
    class="stretched-link"
    aria-label={datasource.name.content}
  ></a>
</div>
