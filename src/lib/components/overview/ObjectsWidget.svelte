<script>
  import { page } from "$app/state";
  import ObjectsGallery from "./ObjectsGallery.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t, translationState } = getTranslationStore();
  const { objectsEdited, objectsInProgress } = $props();

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      objects: t("common.objects", { fallback: "Objects" }),
      lastEdited: t("common.last-edited", { fallback: "Last Edited" }),
      inProgress: t("common.in-progress", { fallback: "In Progress" }),
    };
  });
</script>

<div class="bg-white rounded border d-flex flex-column py-4">
  <h3 class="mb-3 mx-3">
    {i18n.objects}
  </h3>
  <div class="border-top pt-2 mb-3">
    <ObjectsGallery
      objects={objectsEdited}
      title={i18n.lastEdited}
      url="{page.url.pathname}/objects"
    />
  </div>
  <div class="border-top pt-2">
    <ObjectsGallery
      objects={objectsInProgress}
      title={i18n.inProgress}
      url="{page.url.pathname}/objects"
    />
  </div>
</div>
