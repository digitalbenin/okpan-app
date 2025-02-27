<script>
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";

    // Get the translation store
    const { t } = getTranslationStore();

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
</script>

<header
    class="navbar navbar-expand-lg navbar-light bg-light border-bottom py-2 px-3 px-sm-4"
>
    <div class="container-fluid">
        <div class="d-flex align-items-center">
            <button
                class="btn btn-outline-secondary me-2 py-1 px-2 py-sm-2 px-sm-3"
                onclick={goHome}
                aria-label="Go to home page"
            >
                <i class="bi bi-house-door"></i>
                <span class="ms-1 d-none d-sm-inline"
                    >{t("nav.home", { fallback: "Home" })}</span
                >
            </button>

            <button
                class="btn btn-outline-secondary py-1 px-2 py-sm-2 px-sm-3"
                onclick={goBack}
                disabled={navigationHistory.length === 0}
                aria-label="Go back to previous page"
            >
                <i class="bi bi-arrow-left"></i>
                <span class="ms-1 d-none d-sm-inline"
                    >{t("nav.back", { fallback: "Back" })}</span
                >
            </button>
        </div>

        <div class="navbar-brand mx-auto">
            {t("common.title", { fallback: "DB Connection Tool" })}
        </div>

        <div class="d-flex">
            <!-- Action buttons can be added here -->
        </div>
    </div>
</header>
