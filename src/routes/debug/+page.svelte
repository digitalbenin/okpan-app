<script>
  import { goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  // Get the store
  const { translationState, t, refreshTranslations } = getTranslationStore();
</script>

<div class="container-fluid py-4">
  <div class="d-flex flex-column gap-0">
    <BaseButton
      text={t("nav.test", { fallback: "Test Graphql" })}
      icon="code-slash"
      onClick={() => goto("/test/graphql")}
      class="btn btn-link d-flex align-items-center text-decoration-none"
    />

    <BaseButton
      text={t("common.translations", { fallback: "Translations" })}
      icon="translate"
      onClick={() => goto("/translations")}
      class="btn btn-link d-flex align-items-center text-decoration-none"
    />

    <BaseButton
      text={t("common.logs", { fallback: "Logs" })}
      icon="list"
      onClick={() => goto("/logs")}
      class="btn btn-link d-flex align-items-center text-decoration-none"
    />

    <BaseButton
      text={t("common.ui", { fallback: "UI components" })}
      icon="ui-checks"
      onClick={() => goto("/test/ui")}
      class="btn btn-link d-flex align-items-center text-decoration-none"
    />

    <BaseButton
      text={t("common.assets", { fallback: "Assets" })}
      icon="file-earmark-image"
      onClick={() => goto("/test/assets")}
      class="btn btn-link d-flex align-items-center text-decoration-none"
    />

    <BaseButton
      text={t("common.projects", { fallback: "Projects" })}
      icon="folder2-open"
      onClick={() => goto("/projects")}
      class="btn btn-link d-flex align-items-center text-decoration-none"
    />
  </div>
</div>
