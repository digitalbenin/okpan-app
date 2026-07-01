<script>
  import { page } from "$app/state";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  const projectId = $derived(page.data?.project?.id);
  const { translationState } = getTranslationStore();

  const srcUrl = $derived.by(() => {
    const url = new URL("website://app/");

    if (projectId) {
      url.searchParams.set("project_id", projectId);
    }

    if (translationState.currentLocale) {
      url.searchParams.set("interface_language", translationState.currentLocale);
    }

    return url.toString();
  });
</script>

<div class="explorer-container h-100 my-n4 mx-n4">
  <iframe src={srcUrl} title="Data Explorer" class="explorer-frame"></iframe>
</div>

<style>

  .explorer-frame {
    width: 100%;
    height: 100%;
    border: 0;
    background: transparent;
  }
</style>