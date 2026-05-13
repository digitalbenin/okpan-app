<script>
  import { page } from "$app/state";
  import ObjectsGallery from "./ObjectsGallery.svelte";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  const { t, translationState } = getTranslationStore();
  const { objects } = $props();

  const i18n = $derived.by(() => {
    translationState.isInitialized;
    translationState.currentLocale;

    return {
      recentlyEditedObjects: t("overview.recently-edited-objects", { fallback: "Recently edited objects" }),
    };
  });
</script>

<div>
  <ObjectsGallery
    objects={objects}
    title={i18n.recentlyEditedObjects}
    url="{page.url.pathname}/objects"
  />
</div>
