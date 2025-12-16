<script>
  const { status, showChevron = false, className = "" } = $props();
</script>

<span
  class={`badge fw-normal text-capitalize ${className}`}
  class:text-bg-success={status === "completed"}
  class:text-bg-warning={status === "in progress"}
>
  {status}
  {#if showChevron}
    <i class="bi bi-chevron-down ms-1"></i>
  {/if}
  
</span>
