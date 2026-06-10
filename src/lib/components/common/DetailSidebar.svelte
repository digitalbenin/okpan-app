<script>
  let {
    children,
    class: className = "",
  } = $props();
</script>

<div class={`col-12 col-lg-4 ${className}`}>
  <div class="bg-white p-3 rounded">
    {@render children?.()}
  </div>
</div>
