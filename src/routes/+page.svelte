<script>
  import { goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

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
  <!-- Example of showing loading state -->
  {#if translationState.isLoading}
    <div class="alert alert-info">Loading translations...</div>
  {/if}

  <!-- Example of showing error state -->
  {#if translationState.error}
    <div class="alert alert-danger">
      {translationState.error}
      <button
        class="btn btn-sm btn-outline-danger ms-2"
        onclick={handleRefreshTranslations}
      >
        Retry
      </button>
    </div>
  {/if}

  <div class="d-flex flex-column gap-0">
    <button
      class="btn btn-link d-flex align-items-center text-decoration-none"
      onclick={() => goto("/test")}
    >
      <i class="bi bi-box-arrow-right me-2"></i>
      {t("nav.test", { fallback: "Test Graphql" })}
    </button>

    <button
      class="btn btn-link d-flex align-items-center text-decoration-none"
      onclick={() => goto("/translations")}
    >
      <i class="bi bi-translate me-2"></i>
      {t("common.translations", { fallback: "Translations" })}
    </button>
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
