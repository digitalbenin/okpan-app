<script>
  import { goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  // Get the store
  const { translationState, t, refreshTranslations } = getTranslationStore();

  // Example of using $effect to react to locale changes
  $effect(() => {
    console.log(`Current locale changed to: ${translationState.currentLocale}`);
  });

  // Function to manually refresh translations if needed
  async function handleRefreshTranslations() {
    await refreshTranslations();
  }
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

  <!-- 
    USAGE EXAMPLES (commented out):
    
    1. Basic translation:
    {t('namespace.key')}
    
    2. Translation with parameters:
    {t('namespace.key', { param1: 'value1', param2: 'value2' })}
    
    3. Translation with fallback:
    {t('namespace.key', { fallback: 'Fallback text' })}
    
    4. Accessing current locale:
    Current language: {translationState.currentLocale}
    
    5. Checking if translations are loaded:
    {#if !translationState.isLoading && translationState.isInitialized}
      Translations are ready!
    {/if}
    
    6. Listing available namespaces:
    {#each getAvailableNamespaces() as namespace}
      <div>{namespace}</div>
    {/each}
    
    7. Manually refreshing translations:
    <button onclick={() => refreshTranslations()}>Refresh</button>
  -->
</div>

<style>
  :global(.bi) {
    font-size: 1.1rem;
  }
</style>
