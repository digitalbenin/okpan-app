<script>
  const { status } = $props();
</script>

<span
  class="badge fw-normal text-capitalize"
  class:text-bg-success={status === "completed"}
  class:text-bg-warning={status === "in progress"}
>
  {status}
</span>
