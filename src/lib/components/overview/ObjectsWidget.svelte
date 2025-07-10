<script>
  import { page } from "$app/state";
  import ObjectsGallery from "./ObjectsGallery.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t } = getTranslationStore();
  const { objectsEdited, objectsInProgress } = $props();
</script>

<div class="bg-white rounded border d-flex flex-column py-4">
  <h3 class="mb-3 mx-3 border-bottom pb-2">
    {t("common.objects", { fallback: "Objects" })}
  </h3>
  <div class="pb-3 mb-3 border-bottom">
    <ObjectsGallery
      objects={objectsEdited}
      title={t("common.last-edited", { fallback: "Last Edited" })}
      url="{page.url.pathname}/objects"
    />
  </div>
  <div>
    <ObjectsGallery
      objects={objectsInProgress}
      title={t("common.in-progress", { fallback: "In Progress" })}
      url="{page.url.pathname}/objects"
    />
  </div>
</div>
