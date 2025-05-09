<script>
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
  import BaseButton from "$lib/components/base/BaseButton.svelte";

  // Get the translation store
  const { t, translationState, setLocale } = getTranslationStore();

  // Store for navigation history using $state
  let navigationHistory = $state([]);
  let currentPath = $state("");

  // Initialize with current path
  currentPath = $page.url.pathname;

  // Subscribe to page changes to track history
  $effect(() => {
    const path = $page.url.pathname;

    // Only add to history if it's a new path
    if (path !== currentPath && !navigationHistory.includes(path)) {
      navigationHistory = [...navigationHistory, currentPath];
      // Keep only the last 10 paths in history
      if (navigationHistory.length > 10) {
        navigationHistory = navigationHistory.slice(-10);
      }
    }

    currentPath = path;
  });

  // Function to navigate back to the previous page
  function goBack() {
    if (navigationHistory.length > 0) {
      const previousPath = navigationHistory.pop();
      goto(previousPath);
    }
  }

  // Function to go to home page
  function goHome() {
    goto("/");
  }

  // Function to switch language
  function switchLanguage(locale) {
    setLocale(locale);
  }
</script>

<header
  class="navbar navbar-expand-lg navbar-light bg-danger-subtle border-bottom py-2"
>
  <div class="container-fluid">
    <div class="d-flex align-items-center">
      <BaseButton
        text={t("nav.back", { fallback: "Back" })}
        icon="arrow-left"
        disabled={navigationHistory.length === 0}
        onClick={goBack}
        class="d-flex align-items-center gap-1 btn btn-sm px-2 mx-1 {navigationHistory.length ===
        0
          ? 'text-secondary opacity-50'
          : ''}"
      />
    </div>

    <BaseButton
      text={t("common.title", { fallback: "DB Connection Tool" })}
      onClick={goHome}
      class="navbar-brand mx-auto btn btn-link border-0"
    />

    <div class="d-flex align-items-center">
      <!-- Language selector -->
      <div class="d-flex">
        {#each translationState.languages as language}
          <BaseButton
            text={language.code.toUpperCase()}
            onClick={() => switchLanguage(language.code)}
            class="btn btn-sm px-2 mx-1 {translationState.currentLocale ===
            language.code
              ? 'fw-bold text-primary'
              : 'text-secondary opacity-50'}"
          />
        {/each}
      </div>
    </div>
  </div>
</header>
