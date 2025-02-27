<script>
  import { goto } from "$app/navigation";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

  // Get the store
  const { translationState, t, setLocale, refreshTranslations } =
    getTranslationStore();

  let count = $state(0);

  function increment() {
    count += 1;
  }

  async function handlePing() {
    const response = await window.api.ping();
    console.log("Frontend received:", response);
  }

  // Example function to switch language
  function switchLanguage(locale) {
    setLocale(locale);
  }

  // Example of using $effect to react to locale changes
  $effect(() => {
    console.log(`Current locale changed to: ${translationState.currentLocale}`);
  });

  // Function to manually refresh translations if needed
  async function handleRefreshTranslations() {
    await refreshTranslations();
  }
</script>

<div class="container py-4">
  <!-- Example of using the translation store with the t() function -->
  <h1 class="display-4 mb-4">
    {t("common.title", { fallback: "Data Connection Tool!" })}
  </h1>

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

  <div class="d-flex gap-3">
    <button
      class="btn btn-primary d-flex align-items-center"
      onclick={increment}
    >
      <i class="bi bi-plus-circle me-2"></i>
      <!-- Example of using translation with parameters -->
      {t("common.click", { fallback: `clicks` })}
      {count}
    </button>

    <button
      class="btn btn-success d-flex align-items-center"
      onclick={handlePing}
    >
      <i class="bi bi-arrow-repeat me-2"></i>
      <!-- Simple translation example -->
      {t("common.ping", { fallback: "Send Ping" })}
    </button>

    <button
      class="btn btn-info d-flex align-items-center"
      onclick={() => goto("/test")}
    >
      <i class="bi bi-box-arrow-right me-2"></i>
      {t("nav.test", { fallback: "Test Graphql" })}
    </button>

    <button
      class="btn btn-info d-flex align-items-center"
      onclick={() => goto("/translations")}
    >
      <i class="bi bi-translate me-2"></i>
      {t("common.translations", { fallback: "Translations" })}
    </button>
  </div>

  <!-- Example of language switcher -->
  <div class="mt-4">
    <h5>{t("common.language", { fallback: "Language" })}:</h5>
    <div class="btn-group">
      {#each translationState.languages as language}
        <button
          class="btn btn-outline-secondary {translationState.currentLocale ===
          language.code
            ? 'active'
            : ''}"
          onclick={() => switchLanguage(language.code)}
        >
          {language.name}
        </button>
      {/each}
    </div>
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
