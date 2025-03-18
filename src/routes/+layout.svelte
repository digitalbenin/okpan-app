<script>
    import "../assets/main.scss";
    import "bootstrap-icons/font/bootstrap-icons.css";
    import "bootstrap/dist/js/bootstrap.bundle.min.js";
    // Import the store to ensure it's loaded
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import Header from "$lib/components/Header.svelte";
    import BaseToast from "$lib/components/base/BaseToast.svelte";

    let { children } = $props();

    // Initialize stores
    getTranslationStore();
</script>

<div class="app-container d-flex flex-column min-vh-100">
    <Header />

    <main class="container-fluid p-0 flex-grow-1">
        {@render children()}
        <BaseToast />
    </main>
</div>

<style>
    .app-container {
        min-height: 100vh;
    }

    main {
        flex: 1;
    }
</style>
