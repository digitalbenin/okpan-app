<script>
  import { goto } from "$app/navigation";

  let count = $state(0);

  function increment() {
    count += 1;
  }

  async function handlePing() {
    const response = await window.api.ping();
    console.log("Frontend received:", response);
  }
</script>

<div class="container py-4">
  <h1 class="display-4 mb-4">Data Connection Tool!</h1>

  <div class="d-flex gap-3">
    <button
      class="btn btn-primary d-flex align-items-center"
      onclick={increment}
    >
      <i class="bi bi-plus-circle me-2"></i>
      Clicks: {count}
    </button>

    <button
      class="btn btn-success d-flex align-items-center"
      onclick={handlePing}
    >
      <i class="bi bi-arrow-repeat me-2"></i>
      Send Ping
    </button>

    <button
      class="btn btn-info d-flex align-items-center"
      onclick={() => goto("/test")}
    >
      <i class="bi bi-box-arrow-right me-2"></i>
      Test
    </button>
  </div>
</div>

<style>
  :global(.bi) {
    font-size: 1.1rem;
  }
</style>
