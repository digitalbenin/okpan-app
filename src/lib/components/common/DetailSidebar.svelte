<script>
  let {
    children,
    class: className = "",
  } = $props();
</script>

<div class={`col-12 col-lg-4 ${className}`}>
  <div class="bg-white p-4 rounded h-100 sticky-lg-top" style="top: 1rem; z-index: 1;">
    {@render children?.()}
  </div>
</div>
