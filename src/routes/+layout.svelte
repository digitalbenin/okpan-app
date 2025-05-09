<script>
  import "../assets/main.scss";
  import "bootstrap-icons/font/bootstrap-icons.css";
  // import "bootstrap/dist/js/bootstrap.bundle.min.js";
  // Import the store to ensure it's loaded
  import Header from "$lib/components/Header.svelte";
  import BaseToast from "$lib/components/base/BaseToast.svelte";

  let { children } = $props();
</script>

<div class="d-flex flex-column vh-100">
  <Header />

  <div class="flex-grow-1 flex-shrink-1">
    {@render children()}
    <BaseToast />
  </div>
</div>
