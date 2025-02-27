<script>
    import "../assets/main.scss";
    import "bootstrap-icons/font/bootstrap-icons.css";
    import "bootstrap/dist/js/bootstrap.bundle.min.js";
    // Import the store to ensure it's loaded
    import { getTranslationStore } from "$lib/stores/InterfaceTranslationStore.svelte.js";
    import Header from "$lib/components/Header.svelte";

    // Just get the store, initialization happens automatically
    getTranslationStore();
</script>

<div class="app-container d-flex flex-column min-vh-100">
    <Header />

    <main class="container-fluid py-3 flex-grow-1">
        <slot />
    </main>
</div>

<style>
    .app-container {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
    }

    main {
        flex: 1;
    }
</style>
